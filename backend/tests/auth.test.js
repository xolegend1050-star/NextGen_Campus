const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const db = require('../src/config/database');

const VALID_PASSWORD = 'Password1';
const FAKE_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

async function makeRequest(method, path, body = {}, headers = {}) {
  const express = require('express');
  const request = require('supertest');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  const req = request(app)[method.toLowerCase()](path)
    .set('Content-Type', 'application/json')
    .set(headers);
  return body && Object.keys(body).length > 0 ? req.send(body) : req;
}

describe('Auth Controller', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@student.com', role: 'student', created_at: new Date() }] }) // Insert user
        .mockResolvedValueOnce({ rows: [] }) // Insert profile
        .mockResolvedValueOnce({ rows: [] }) // Store session
        .mockResolvedValueOnce({ rows: [] }); // Verification token

      const res = await makeRequest('POST', '/api/auth/register', {
        email: 'test@student.com',
        password: VALID_PASSWORD,
        role: 'student',
        full_name: 'Test Student'
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@student.com');
      expect(res.body.user.role).toBe('student');
    });

    it('should return 409 if email already exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await makeRequest('POST', '/api/auth/register', {
        email: 'existing@student.com',
        password: VALID_PASSWORD,
        role: 'student',
        full_name: 'Existing User'
      });

      expect(res.status).toBe(409);
    });

    it('should return 400 for invalid email', async () => {
      const res = await makeRequest('POST', '/api/auth/register', {
        email: 'not-an-email',
        password: VALID_PASSWORD,
        role: 'student',
        full_name: 'Test'
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for weak password', async () => {
      const res = await makeRequest('POST', '/api/auth/register', {
        email: 'test@student.com',
        password: 'weak',
        role: 'student',
        full_name: 'Test'
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const hash = await bcrypt.hash(VALID_PASSWORD, 10);
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, email: 'test@student.com', password_hash: hash, role: 'student', is_active: true, is_banned: false }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'test@student.com',
        password: VALID_PASSWORD
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should return 401 with invalid password', async () => {
      const hash = await bcrypt.hash('OtherPass1', 10);
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@student.com', password_hash: hash, role: 'student', is_active: true, is_banned: false }]
      });

      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'test@student.com',
        password: VALID_PASSWORD
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent user', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'nobody@student.com',
        password: VALID_PASSWORD
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const refreshToken = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '7d' });
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10, refresh_token_hash: refreshToken }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true, is_banned: false }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await makeRequest('POST', '/api/auth/refresh', { refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('should return 401 with invalid refresh token', async () => {
      const res = await makeRequest('POST', '/api/auth/refresh', { refreshToken: 'garbage' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      const token = makeToken(1);
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@student.com', role: 'student', is_active: true, is_banned: false }] })
        .mockResolvedValueOnce({ rows: [{ full_name: 'Test Student', trust_score: 50 }] });

      const res = await makeRequest('GET', '/api/auth/me', {}, { Authorization: `Bearer ${token}` });
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('should return 401 without token', async () => {
      const res = await makeRequest('GET', '/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
