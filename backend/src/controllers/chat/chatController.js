const db = require('../../config/database');
const logger = require('../../utils/logger');

exports.getConversations = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND NOT $1 = ANY(read_by) AND sender_id != $1) as unread_count,
              json_agg(json_build_object(
                'id', cp.user_id,
                'full_name', p.full_name,
                'avatar_url', p.avatar_url
              )) as participants
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       JOIN users u ON cp.user_id = u.id
       JOIN profiles p ON u.id = p.user_id
       WHERE cp.user_id = $1 AND c.is_active = true
       GROUP BY c.id
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.user.id]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.createConversation = async (req, res, next) => {
  try {
    const { participant_id, type, title, related_request_id, related_gig_id } = req.body;

    // Check if conversation already exists between these users
    const existing = await db.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.type = $3 AND c.is_active = true`,
      [req.user.id, participant_id, type || 'general']
    );

    if (existing.rows.length > 0) {
      return res.json({ conversation: { id: existing.rows[0].id }, existing: true });
    }

    // Create new conversation
    const conversation = await db.query(
      `INSERT INTO conversations (type, title, related_request_id, related_gig_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [type || 'general', title || null, related_request_id || null, related_gig_id || null]
    );

    // Add participants
    await db.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
      [conversation.rows[0].id, req.user.id]
    );
    await db.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
      [conversation.rows[0].id, participant_id]
    );

    logger.info(`Conversation created: ${conversation.rows[0].id}`);
    res.status(201).json({ conversation: conversation.rows[0], existing: false });
  } catch (error) {
    next(error);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Check if user is participant
    const participant = await db.query(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );

    if (participant.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to access this conversation' });
    }

    const result = await db.query(
      `SELECT m.*,
              u.email as sender_email,
              p.full_name as sender_name,
              p.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       JOIN profiles p ON u.id = p.user_id
       WHERE m.conversation_id = $1 AND m.is_deleted = false
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    // Mark messages as read
    await db.query(
      `UPDATE conversation_participants 
       SET last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.user.id]
    );

    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content, message_type = 'text', file_url, file_name, file_size } = req.body;

    // Check if user is participant
    const participant = await db.query(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );

    if (participant.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to send messages in this conversation' });
    }

    // Check if conversation is active
    const conversation = await db.query(
      'SELECT is_active FROM conversations WHERE id = $1',
      [conversationId]
    );

    if (!conversation.rows[0].is_active) {
      return res.status(400).json({ error: 'Conversation is no longer active' });
    }

    // Create message
    const result = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [conversationId, req.user.id, content || null, message_type, file_url || null, file_name || null, file_size || null]
    );

    // Update conversation timestamp
    await db.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    // Get sender profile for real-time
    const sender = await db.query(
      'SELECT full_name, avatar_url FROM profiles WHERE user_id = $1',
      [req.user.id]
    );

    const messageWithSender = {
      ...result.rows[0],
      sender_name: sender.rows[0].full_name,
      sender_avatar: sender.rows[0].avatar_url
    };

    // Emit to Socket.IO (if available)
    const io = req.app.get('io');
    if (io) {
      io.to(conversationId).emit('receive_message', messageWithSender);
    }

    logger.info(`Message sent in conversation ${conversationId}`);
    res.status(201).json({ message: messageWithSender });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const result = await db.query(
      `UPDATE messages 
       SET read_by = array_append(read_by, $1)
       WHERE id = $2 AND NOT $1 = ANY(read_by)
       RETURNING *`,
      [req.user.id, messageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or already read' });
    }

    res.json({ message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
};
