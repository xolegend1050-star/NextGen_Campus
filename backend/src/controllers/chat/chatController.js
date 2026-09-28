const db = require('../../config/database');
const logger = require('../../utils/logger');
const path = require('path');

exports.getConversations = async (req, res, next) => {
  try {
    // Membership is tested with EXISTS rather than by joining and filtering
    // conversation_participants. The old join combined with
    // `WHERE cp.user_id = $1` left a single participant row per conversation,
    // so the json_agg produced an array containing only the caller, and the
    // chat list could never show who you were talking to.
    const result = await db.query(
      `SELECT c.id, c.type, c.title, c.related_gig_id, c.created_at, c.updated_at,
              (SELECT content FROM messages
                WHERE conversation_id = c.id AND is_deleted = false
                ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages
                WHERE conversation_id = c.id AND is_deleted = false
                ORDER BY created_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*)::int FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.is_deleted = false
                  AND m.sender_id <> $1
                  AND NOT ($1 = ANY(m.read_by))) AS unread_count,
              COALESCE((
                SELECT json_agg(json_build_object(
                         'id', p2.user_id,
                         'full_name', pr.full_name,
                         'avatar_url', pr.avatar_url,
                         'email', u2.email
                       ) ORDER BY pr.full_name)
                  FROM conversation_participants p2
                  JOIN users u2 ON u2.id = p2.user_id
                  LEFT JOIN profiles pr ON pr.user_id = p2.user_id
                 WHERE p2.conversation_id = c.id
              ), '[]'::json) AS participants
         FROM conversations c
        WHERE c.is_active = true
          AND EXISTS (SELECT 1 FROM conversation_participants mine
                       WHERE mine.conversation_id = c.id AND mine.user_id = $1)
        ORDER BY last_message_at DESC NULLS LAST, c.updated_at DESC
        LIMIT 100`,
      [req.user.id]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    next(error);
  }
};

/** Total unread messages across every conversation, for a global badge. */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM messages m
         JOIN conversation_participants cp
           ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
        WHERE m.is_deleted = false
          AND m.sender_id <> $1
          AND NOT ($1 = ANY(m.read_by))`,
      [req.user.id]
    );

    res.json({ count: result.rows[0].count });
  } catch (error) {
    next(error);
  }
};

exports.createConversation = async (req, res, next) => {
  try {
    const { participant_id, participant_ids, type, title, related_request_id, related_gig_id } = req.body;

    // Accept either a single participant_id or a list for group chats
    const requested = Array.isArray(participant_ids) && participant_ids.length
      ? participant_ids
      : participant_id
        ? [participant_id]
        : [];

    if (requested.length === 0) {
      return res.status(400).json({ error: 'participant_id is required' });
    }

    const others = [...new Set(requested.filter((id) => id && id !== req.user.id))];

    if (others.length === 0) {
      return res.status(400).json({ error: 'You cannot start a conversation with yourself' });
    }

    if (others.length > 20) {
      return res.status(400).json({ error: 'A conversation can have at most 20 other participants' });
    }

    // Every participant must be a real, active user, otherwise the conversation
    // is created with dangling participant rows and renders as empty.
    const targets = await db.query(
      'SELECT id FROM users WHERE id = ANY($1) AND is_active = true AND is_banned = false',
      [others]
    );

    if (targets.rows.length !== others.length) {
      return res.status(404).json({ error: 'One or more users not found' });
    }

    const isGroup = others.length > 1;
    const convType = type || (isGroup ? 'group' : 'general');

    // Reuse a conversation only when the exact same set of people already has
    // one. For a DM that is the previous single-participant check; for a group
    // it must match every member, otherwise two different groups would collide
    // on the first shared pair. The counts are filtered in an outer query
    // because Postgres will not resolve a SELECT alias inside HAVING.
    const existing = await db.query(
      `SELECT id FROM (
         SELECT c.id,
                (SELECT COUNT(*) FROM conversation_participants x
                  WHERE x.conversation_id = c.id) AS member_count,
                (SELECT COUNT(*) FROM conversation_participants x
                  WHERE x.conversation_id = c.id AND x.user_id = ANY($1)) AS matched
           FROM conversations c
          WHERE c.type = $2 AND c.is_active = true
            AND EXISTS (SELECT 1 FROM conversation_participants cp
                         WHERE cp.conversation_id = c.id AND cp.user_id = $3)
       ) AS candidates
        WHERE matched = $4 AND member_count = $5
        LIMIT 1`,
      // matched counts only the requested others, member_count includes the
      // creator, so they are compared against different totals
      [others, convType, req.user.id, others.length, others.length + 1]
    );

    if (existing.rows.length > 0) {
      return res.json({ conversation: { id: existing.rows[0].id }, existing: true });
    }

    const conversation = await db.query(
      `INSERT INTO conversations (type, title, related_request_id, related_gig_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [convType, title || (isGroup ? 'Group conversation' : null), related_request_id || null, related_gig_id || null]
    );

    // Add everyone, including the creator
    const allMembers = [req.user.id, ...others];
    await db.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversation.rows[0].id, allMembers]
    );

    logger.info(`Conversation created: ${conversation.rows[0].id} with ${allMembers.length} members`);
    res.status(201).json({
      conversation: { ...conversation.rows[0], participants: allMembers.length },
      existing: false
    });
  } catch (error) {
    next(error);
  }
};

/** Add a member to an existing group conversation. */
exports.addParticipant = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const isMember = await db.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.id]
    );
    if (isMember.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }

    const target = await db.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true AND is_banned = false',
      [user_id]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [conversationId, user_id]
    );

    const count = await db.query(
      'SELECT COUNT(*)::int AS n FROM conversation_participants WHERE conversation_id = $1',
      [conversationId]
    );

    emitToConversation(req, conversationId, 'participant_added', {
      conversation_id: conversationId,
      user_id,
      members: count.rows[0].n
    });

    res.json({ success: true, members: count.rows[0].n });
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

    // Opening a conversation marks it read. This previously only bumped
    // conversation_participants.last_read_at, which nothing read: the unread
    // count is computed from messages.read_by, so the badge never cleared and
    // grew without bound.
    const markedRead = await db.query(
      `UPDATE messages m
          SET read_by = CASE
                WHEN $2 = ANY(m.read_by) THEN m.read_by
                ELSE array_append(m.read_by, $2)
              END
         WHERE m.conversation_id = $1
           AND m.is_deleted = false
           AND m.sender_id <> $2
           AND NOT ($2 = ANY(m.read_by))
        RETURNING m.id`,
      [conversationId, req.user.id]
    );

    if (markedRead.rows.length > 0) {
      await db.query(
        `UPDATE conversation_participants
            SET last_read_at = NOW()
          WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, req.user.id]
      );
    }

    // Reflect the receipts on the rows we are about to return, so the client
    // can render them without a second round trip.
    const messages = result.rows.reverse().map((m) => {
      const readBy = Array.isArray(m.read_by) ? [...m.read_by] : [];
      if (!readBy.includes(req.user.id) && m.sender_id !== req.user.id) {
        readBy.push(req.user.id);
      }
      return { ...m, read_by: readBy };
    });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
};

const roomName = (conversationId) => `conversation_${conversationId}`;

/** Broadcast to a conversation, whichever io instance is reachable. */
const emitToConversation = (req, conversationId, event, payload) => {
  const io = req.app.get('io');
  if (!io) return;
  // Rooms are named conversation_<id> (see join_room). The REST send path used
  // the bare id, so a message sent while the socket was down never reached
  // anyone who was connected.
  io.to(roomName(conversationId)).emit(event, payload);
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content, message_type = 'text', file_url, file_name, file_size } = req.body;

    // A message needs text, an attachment, or both
    const hasContent = typeof content === 'string' && content.trim().length > 0;
    const hasFile = typeof file_url === 'string' && file_url.startsWith('/uploads/');
    if (!hasContent && !hasFile) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Only allow attachments that were actually uploaded to our own store,
    // otherwise a client could point at any URL
    if (file_url && !hasFile) {
      return res.status(400).json({ error: 'Invalid attachment url' });
    }

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

    if (conversation.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!conversation.rows[0].is_active) {
      return res.status(400).json({ error: 'Conversation is no longer active' });
    }

    const type = hasFile ? (message_type === 'text' ? 'file' : message_type) : 'text';

    const result = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [conversationId, req.user.id, hasContent ? content.trim() : null, type,
       hasFile ? file_url : null, hasFile ? (file_name || null) : null, hasFile ? (file_size || null) : null]
    );

    await db.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    const sender = await db.query(
      'SELECT full_name, avatar_url FROM profiles WHERE user_id = $1',
      [req.user.id]
    );

    const messageWithSender = {
      ...result.rows[0],
      sender_name: sender.rows[0]?.full_name,
      sender_avatar: sender.rows[0]?.avatar_url,
      room: roomName(conversationId)
    };

    emitToConversation(req, conversationId, 'receive_message', messageWithSender);

    logger.info(`Message sent in conversation ${conversationId}`);
    res.status(201).json({ message: messageWithSender });
  } catch (error) {
    next(error);
  }
};

/** Load a message and confirm the caller may act on it. */
const loadOwnMessage = async (req, messageId) => {
  const result = await db.query(
    'SELECT id, conversation_id, sender_id, content, is_edited, is_deleted FROM messages WHERE id = $1',
    [messageId]
  );

  if (result.rows.length === 0) return { error: { status: 404, message: 'Message not found' } };
  if (result.rows[0].sender_id !== req.user.id) {
    return { error: { status: 403, message: 'You can only change your own messages' } };
  }
  if (result.rows[0].is_deleted) {
    return { error: { status: 400, message: 'Message has been deleted' } };
  }
  return { message: result.rows[0] };
};

/**
 * Edit a message. Soft-edits keep the original row so read receipts and the
 * conversation history stay intact; is_edited flags it for the UI.
 */
exports.editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Content cannot be empty' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Message is too long' });
    }

    const { message, error } = await loadOwnMessage(req, messageId);
    if (error) return res.status(error.status).json({ error: error.message });

    const result = await db.query(
      `UPDATE messages
          SET content = $1, is_edited = true, updated_at = NOW()
        WHERE id = $2
        RETURNING *`,
      [content.trim(), messageId]
    );

    const payload = {
      ...result.rows[0],
      room: roomName(message.conversation_id)
    };
    emitToConversation(req, message.conversation_id, 'message_updated', payload);

    res.json({ message: payload });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a message. Soft delete (is_deleted) so the row, its read receipts and
 * any moderation history survive; the content is cleared so the text is not
 * recoverable through the API.
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const { message, error } = await loadOwnMessage(req, messageId);
    if (error) return res.status(error.status).json({ error: error.message });

    await db.query(
      'UPDATE messages SET is_deleted = true, content = NULL, file_url = NULL, updated_at = NOW() WHERE id = $1',
      [messageId]
    );

    emitToConversation(req, message.conversation_id, 'message_deleted', {
      id: messageId,
      conversation_id: message.conversation_id,
      room: roomName(message.conversation_id)
    });

    res.json({ success: true, id: messageId });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload a file to attach to a message. The returned url is what the client
 * passes back to sendMessage, which only accepts paths under /uploads/chat/.
 */
exports.uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Keep the name the user recognises, but strip anything path-like
    const safeName = path.basename(req.file.originalname || 'attachment').slice(0, 200);

    res.status(201).json({
      success: true,
      url: `/uploads/chat/${req.file.filename}`,
      file_name: safeName,
      size: req.file.size,
      mime_type: req.file.mimetype
    });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File is too large (max 10MB)' });
    }
    if (error.message && /only images|invalid file type/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

/**
 * Mark one message or a whole conversation as read.
 *
 * Previously this took a single messageId and never checked that the caller
 * belonged to the conversation, so any authenticated user could mark any
 * message read. It also only ever handled one row, which would have meant a
 * request per message to clear a page.
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { messageId, conversationId } = req.params;

    let conversation;

    if (conversationId) {
      const check = await db.query(
        'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, req.user.id]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to access this conversation' });
      }
      conversation = conversationId;
    } else {
      const msg = await db.query(
        `SELECT m.conversation_id,
                EXISTS (SELECT 1 FROM conversation_participants cp
                         WHERE cp.conversation_id = m.conversation_id
                           AND cp.user_id = $2) AS is_participant
           FROM messages m
          WHERE m.id = $1`,
        [messageId, req.user.id]
      );

      if (msg.rows.length === 0) {
        return res.status(404).json({ error: 'Message not found' });
      }
      if (!msg.rows[0].is_participant) {
        return res.status(403).json({ error: 'Not authorized to access this conversation' });
      }
      conversation = msg.rows[0].conversation_id;
    }

    const result = await db.query(
      `UPDATE messages
          SET read_by = array_append(read_by, $2)
        WHERE conversation_id = $1
          AND is_deleted = false
          AND NOT ($2 = ANY(read_by))
          AND ($3::uuid IS NULL OR id = $3)
        RETURNING id`,
      [conversation, req.user.id, messageId || null]
    );

    if (result.rows.length > 0) {
      await db.query(
        `UPDATE conversation_participants
            SET last_read_at = NOW()
          WHERE conversation_id = $1 AND user_id = $2`,
        [conversation, req.user.id]
      );
    }

    // Let the other side see the receipts without refreshing
    try {
      const { io } = require('../../server');
      io.to(`conversation_${conversation}`).emit('messages_read', {
        conversation_id: conversation,
        user_id: req.user.id,
        message_ids: result.rows.map((r) => r.id),
        read_at: new Date().toISOString()
      });
    } catch (_) {
      // Socket is optional; a failure here must not fail the request
    }

    res.json({ success: true, marked: result.rows.length, conversation_id: conversation });
  } catch (error) {
    next(error);
  }
};
