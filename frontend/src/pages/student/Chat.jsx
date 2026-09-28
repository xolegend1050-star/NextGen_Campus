import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { getSocket } from '../../utils/socket';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import {
  PaperAirplaneIcon,
  PaperClipIcon,
  UserIcon,
  ChevronLeftIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const Chat = () => {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeRoomRef = useRef(null);

  const roomFor = useCallback((conversationId) => `conversation_${conversationId}`, []);

  useEffect(() => {
    fetchConversations();
    fetchGlobalUnread();
  }, []);

  const [globalUnread, setGlobalUnread] = useState(0);

  // ---- Socket lifecycle ----
  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      console.warn('Chat: socket unavailable, falling back to REST only');
      return;
    }
    socketRef.current = socket;

    const handleConnect = () => {
      setSocketConnected(true);
      // Re-join the active room after a reconnect
      if (activeRoomRef.current) socket.emit('join_room', activeRoomRef.current);
    };
    const handleDisconnect = () => setSocketConnected(false);
    const handleOnlineUsers = (users) => setOnlineUsers(users || []);

    const handleReceive = (payload) => {
      // Only append if the message belongs to the conversation on screen
      const room = payload.room;
      if (!room || room !== activeRoomRef.current) {
        // Message arrived for another conversation: refresh the sidebar instead
        fetchConversations();
        fetchGlobalUnread();
        return;
      }
      // Arriving while the thread is open means it is read immediately
      const readBy = payload.sender_id === user?.id ? [user?.id] : payload.read_by || [];
      setMessages((prev) => {
        if (prev.some((m) => m.id && payload.id && m.id === payload.id)) return prev;
        return [...prev, { ...payload, read_by: readBy }];
      });
    };

    // Someone read our message: upgrade the ticks
    const handleMessagesRead = (payload) => {
      if (payload.conversation_id !== activeRoomRef.current?.replace('conversation_', '')) return;
      if (payload.user_id === user?.id) return;
      const ids = new Set(payload.message_ids || []);
      setMessages((prev) =>
        prev.map((m) =>
          ids.has(m.id)
            ? { ...m, read_by: [...new Set([...(m.read_by || []), payload.user_id])] }
            : m
        )
      );
    };

    const handleTyping = (payload) => {
      if (payload.room !== activeRoomRef.current) return;
      setTypingUsers((prev) => [...new Set([...prev, payload.user_id])]);
    };
    const handleStopTyping = (payload) => {
      setTypingUsers((prev) => prev.filter((id) => id !== payload.user_id));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('online_users', handleOnlineUsers);
    socket.on('receive_message', handleReceive);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_typing', handleTyping);
    socket.on('user_stop_typing', handleStopTyping);

    if (socket.connected) {
      setSocketConnected(true);
      if (activeRoomRef.current) socket.emit('join_room', activeRoomRef.current);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('online_users', handleOnlineUsers);
      socket.off('receive_message', handleReceive);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_typing', handleTyping);
      socket.off('user_stop_typing', handleStopTyping);
    };
  }, [user?.id]);

  // ---- Join / leave room when the open conversation changes ----
  useEffect(() => {
    const socket = socketRef.current;
    const previousRoom = activeRoomRef.current;

    if (!activeConversation) {
      if (previousRoom && socket) socket.emit('leave_room', previousRoom);
      activeRoomRef.current = null;
      setTypingUsers([]);
      return;
    }

    const room = roomFor(activeConversation.id);

    if (socket && socket.connected) {
      if (previousRoom && previousRoom !== room) socket.emit('leave_room', previousRoom);
      socket.emit('join_room', room);
    }
    activeRoomRef.current = room;
    setTypingUsers([]);
  }, [activeConversation, roomFor]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
      markConversationRead(activeConversation.id);
    }
  }, [activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Clear typing indicators after a short idle period
  useEffect(() => {
    if (typingUsers.length === 0) return;
    const t = setTimeout(() => setTypingUsers([]), 3000);
    return () => clearTimeout(t);
  }, [typingUsers]);

  const fetchConversations = async () => {
    try {
      const response = await api.get('/chat/conversations');
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalUnread = async () => {
    try {
      const res = await api.get('/chat/unread-count');
      setGlobalUnread(res.data.count ?? 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await api.get(`/chat/conversations/${conversationId}/messages`);
      setMessages(response.data.messages);
      // Opening the thread marks it read server-side, so refresh the badges
      setConversations(prev =>
        prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      );
      setGlobalUnread(0);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // Explicitly acknowledge, so the sender's ticks update even when the thread
  // was opened from a cached list.
  const markConversationRead = async (conversationId) => {
    try {
      await api.put(`/chat/conversations/${conversationId}/read`);
    } catch (error) {
      // Non-fatal: the count still clears when messages are fetched
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !activeConversation) return;

    setSending(true);
    const room = roomFor(activeConversation.id);
    const socket = socketRef.current;

    try {
      if (socket && socket.connected) {
        // Real-time path: the server persists and broadcasts to the room
        socket.emit('send_message', {
          room,
          content,
          message_type: 'text'
        });
        // The server echoes back to the room (including us), so we do not
        // optimistically append here.
      } else {
        // REST fallback so sending still works without a socket
        const response = await api.post(`/chat/conversations/${activeConversation.id}/messages`, {
          content,
          message_type: 'text'
        });
        setMessages((prev) => [...prev, response.data.message]);
      }
      setNewMessage('');
      socket?.emit('stop_typing', { room });
      fetchConversations();
      fetchGlobalUnread();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTypingChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    const socket = socketRef.current;
    const room = activeRoomRef.current;
    if (!socket || !room || !socket.connected) return;

    socket.emit('typing', { room });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { room });
    }, 1500);
  };

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getOtherParticipant = (conversation) => {
    const participant = conversation?.participants?.find(p => p.id !== user?.id);
    return participant || { id: null, full_name: 'Unknown', avatar_url: null };
  };

  if (loading) return <LoadingSpinner text="Loading chats..." />;

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-xl border overflow-hidden">
      {/* Conversations List. On small screens the list is hidden once a
          conversation is open, so the message pane keeps the full width. */}
      <div
        className={`w-full sm:w-80 sm:flex-shrink-0 border-r bg-gray-50 ${
          activeConversation ? 'hidden sm:block' : 'block'
        }`}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            Messages
            {globalUnread > 0 && (
              <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                {globalUnread}
              </span>
            )}
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              socketConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-200 text-gray-600'
            }`}
            title={socketConnected ? 'Real-time connected' : 'Reconnecting — messages may need a refresh'}
          >
            {socketConnected ? 'Live' : 'Offline'}
          </span>
        </div>
        <div className="overflow-y-auto">
          {conversations.length > 0 ? (
            conversations.map((conv) => {
              const other = getOtherParticipant(conv);
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 text-left ${
                    activeConversation?.id === conv.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {other.avatar_url ? (
                        <img src={other.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <UserIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    {other.id && onlineUsers.includes(other.id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{other.full_name}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {conv.last_message || 'Start a conversation'}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="bg-primary-600 text-white text-xs px-2 py-1 rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center text-gray-500">
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${activeConversation ? 'flex' : 'hidden sm:flex'}`}>
        {activeConversation ? (
          (() => {
            const other = getOtherParticipant(activeConversation);
            const otherIsOnline = other.id && onlineUsers.includes(other.id);
            return (
              <>
                {/* Header */}
                <div className="p-4 border-b flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveConversation(null)}
                    className="sm:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {other.avatar_url ? (
                        <img src={other.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <UserIcon className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    {otherIsOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{other.full_name}</p>
                    <p className={`text-sm ${otherIsOnline ? 'text-green-600' : 'text-gray-500'}`}>
                      {otherIsOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-400 text-sm py-8">
                      No messages yet. Say hello!
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const isOwn = msg.sender_id === user?.id;
                    const readByOthers = (msg.read_by || []).filter((id) => id !== user?.id);
                    const isRead = readByOthers.length > 0;
                    return (
                      <div
                        key={msg.id || `tmp-${i}`}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            isOwn
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={`text-xs mt-1 flex items-center justify-end gap-1 ${
                              isOwn ? 'text-primary-100' : 'text-gray-500'
                            }`}
                          >
                            {new Date(msg.created_at || msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {isOwn && (
                              <span
                                title={isRead ? 'Read' : 'Sent'}
                                className={`inline-flex items-center ${
                                  isRead ? 'text-primary-50' : 'text-primary-200/70'
                                }`}
                              >
                                {isRead ? (
                                  <CheckIcon className="h-3.5 w-3.5" />
                                ) : (
                                  <CheckIcon className="h-3 w-3" />
                                )}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {typingUsers.length > 0 && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg px-4 py-2 text-gray-500 text-sm">
                        {getOtherParticipant(activeConversation).full_name} is typing…
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="p-4 border-t">
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-2 text-gray-500 hover:text-gray-700">
                      <PaperClipIcon className="h-5 w-5" />
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={handleTypingChange}
                      placeholder="Type a message..."
                      className="flex-1 input-field"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="btn-primary p-2"
                    >
                      <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                  </div>
                </form>
              </>
            );
          })()
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon="💬"
              title="Select a conversation"
              description="Choose a conversation from the sidebar to start chatting"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
