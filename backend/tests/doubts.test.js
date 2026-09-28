const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('axios', () => ({
  post: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
}));

// Awarding trust points is a side effect of answering, not part of what this
// suite asserts. Left unmocked it issues its own queries and exhausts the
// mock queue, which surfaced as an opaque 500.
jest.mock('../src/utils/trustTiers', () => ({
  awardPoints: jest.fn().mockResolvedValue({ trust_score: 0, tier: 'bronze' }),
  calculateTrustScore: jest.fn().mockReturnValue({ trust_score: 0, tier: 'bronze' }),
  getTier: jest.fn().mockReturnValue({ name: 'bronze', min: 0, max: 99 })
}));

const db = require('../src/config/database');
const axios = require('axios');

const DOUBT_UUID = '550e8400-e29b-41d4-a716-446655440001';
const ANSWER_UUID = '550e8400-e29b-41d4-a716-446655440002';

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

// The authenticate middleware runs two queries: the user lookup and the
// session-exists check. Both must be mocked or they consume the response the
// controller under test expects.
function mockAuth(userId) {
  db.query
    .mockResolvedValueOnce({
      rows: [{
        id: userId, email: 'test@student.com', role: 'student',
        is_active: true, is_banned: false,
        is_email_verified: true, skip_otp: true
      }]
    })
    .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] });
}

async function makeRequest(method, path, body = {}, headers = {}) {
  const express = require('express');
  const request = require('supertest');
  const app = express();
  app.use(express.json());
  app.use('/api/doubts', require('../src/routes/doubts'));
  // Without this, any thrown error surfaces as an opaque 500 and the real
  // message is lost.
  app.use(require('../src/middleware/errorHandler'));
  const req = request(app)[method.toLowerCase()](path)
    .set('Content-Type', 'application/json')
    .set(headers);
  return body && Object.keys(body).length > 0 ? req.send(body) : req;
}

describe('Doubts Controller', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.AI_SERVICE_URL = 'http://localhost:5001';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks resets recorded calls but NOT the mockResolvedValueOnce
    // queue. A test that queues more responses than it consumes leaves
    // leftovers that the next test silently picks up, which showed up as a
    // spurious 404 in a suite whose logic was correct.
    db.query.mockReset();
  });

  describe('GET /api/doubts', () => {
    it('should return paginated doubts', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: DOUBT_UUID, title: 'Test Doubt', content: 'How to?', author_id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const res = await makeRequest('GET', '/api/doubts');
      expect(res.status).toBe(200);
      expect(res.body.doubts).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('POST /api/doubts', () => {
    it('should create a doubt successfully', async () => {
      mockAuth(1);
      db.query.mockResolvedValueOnce({
        rows: [{ id: DOUBT_UUID, title: 'How to implement JWT authentication in Node.js?', content: 'I need to add auth to my Express app', author_id: 1 }]
      });
      axios.post.mockRejectedValue(new Error('AI unavailable'));

      const token = makeToken(1);
      const res = await makeRequest('POST', '/api/doubts', {
        title: 'How to implement JWT authentication in Node.js?',
        content: 'I need to add authentication to my Express app but I am not sure how to start with JWT tokens.',
        tags: ['javascript', 'auth']
      }, { Authorization: `Bearer ${token}` });

      expect(res.status).toBe(201);
      expect(res.body.doubt.title).toContain('JWT');
    });

    it('should return 401 without auth token', async () => {
      const res = await makeRequest('POST', '/api/doubts', {
        title: 'Test title for validation',
        content: 'This is test content that should be long enough for the validator to accept.',
        tags: ['test']
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/doubts/:id/answers', () => {
    it('should add an answer to a doubt', async () => {
      mockAuth(2);
      db.query
        .mockResolvedValueOnce({ rows: [{ id: DOUBT_UUID, status: 'open' }] })
        .mockResolvedValueOnce({ rows: [{ id: ANSWER_UUID, content: 'Use bcrypt for password hashing in Node.js applications.' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const token = makeToken(2);
      const res = await makeRequest('POST', `/api/doubts/${DOUBT_UUID}/answers`, {
        content: 'Use bcrypt for password hashing in Node.js applications.'
      }, { Authorization: `Bearer ${token}` });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/doubts/:id', () => {
    it('should return a single doubt', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // UPDATE views
        .mockResolvedValueOnce({ rows: [{ id: DOUBT_UUID, title: 'Test Doubt', views: 5 }] }); // SELECT

      const res = await makeRequest('GET', `/api/doubts/${DOUBT_UUID}`);
      expect(res.status).toBe(200);
      expect(res.body.doubt).toBeDefined();
    });

    it('should return 404 for non-existent doubt', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // UPDATE views
        .mockResolvedValueOnce({ rows: [] }); // SELECT

      const res = await makeRequest('GET', `/api/doubts/${DOUBT_UUID}`);
      expect(res.status).toBe(404);
    });
  });
});
