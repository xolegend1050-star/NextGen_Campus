const db = require('../../config/database');
const logger = require('../../utils/logger');

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
    const { participant_id, type, title, related_request_id, related_gig_id } = req.body;

    if (!participant_id) {
      return res.status(400).json({ error: 'participant_id is required' });
    }

    if (participant_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot start a conversation with yourself' });
    }

    // The participant must be a real, active user, otherwise the conversation
    // is created with a dangling participant row and shows up as empty.
    const target = await db.query(
      'SELECT id FROM users WHERE id = $1 AND is_active = true AND is_banned = false',
      [participant_id]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

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
