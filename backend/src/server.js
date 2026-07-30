require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const profileRoutes = require('./routes/profiles');
const doubtRoutes = require('./routes/doubts');
const mentorshipRoutes = require('./routes/mentorship');
const gigRoutes = require('./routes/gigs');
const walletRoutes = require('./routes/wallet');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const analyticsRoutes = require('./routes/analytics');
const resourceRoutes = require('./routes/resources');
const trustRoutes = require('./routes/trust');
const badgeRoutes = require('./routes/badges');
const verificationRoutes = require('./routes/verification');
const aiRoutes = require('./routes/ai');

const app = express();
const httpServer = createServer(app);

// Trust proxy (needed for rate limiter behind Render's reverse proxy)
app.set('trust proxy', 1);

// Socket.IO setup
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  'https://nextgen-campus-8qib.onrender.com',
  'http://localhost:3000'
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: 'Too many requests from this IP, please try again later.',
  validate: { xForwardedForHeader: false }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Swagger API Documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NextGen Campus API',
      version: '1.0.0',
      description: 'Complete API for NextGen Campus Platform',
      contact: {
        name: 'Sujal Borhade',
        email: 'sujal@example.com'
      }
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/doubts', doubtRoutes);
app.use('/api/mentorship', mentorshipRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/trust', trustRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

const jwt = require('jsonwebtoken');
const db = require('./config/database');

// Socket.IO connection handling with auth
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query(
      'SELECT id, email, role, is_active, is_banned FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (result.rows.length === 0 || !result.rows[0].is_active || result.rows[0].is_banned) {
      return next(new Error('Invalid or banned user'));
    }
    socket.user = result.rows[0];
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (user: ${socket.user.id})`);

  socket.on('join_room', (room) => {
    socket.join(room);
    logger.info(`User ${socket.user.id} joined room: ${room}`);
  });

  socket.on('leave_room', (room) => {
    socket.leave(room);
    logger.info(`User ${socket.user.id} left room: ${room}`);
  });

  socket.on('send_message', (data) => {
    io.to(data.room).emit('receive_message', {
      ...data,
      sender_id: socket.user.id,
      sender_name: socket.user.email,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('typing', (data) => {
    io.to(data.room).emit('user_typing', {
      ...data,
      user_id: socket.user.id
    });
  });

  socket.on('stop_typing', (data) => {
    io.to(data.room).emit('user_stop_typing', {
      ...data,
      user_id: socket.user.id
    });
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id} (user: ${socket.user.id})`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`
🚀 NextGen Campus Backend Server
📡 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📚 API Docs: http://localhost:${PORT}/api-docs
  `);
});

module.exports = { app, httpServer, io };
