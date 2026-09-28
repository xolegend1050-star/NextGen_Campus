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

// The password policy (shared with the frontend Zod schemas) requires
// uppercase, lowercase, digit AND a special character. The old value had no
// special character, so every register case failed validation before reaching
// the controller.
const VALID_PASSWORD = 'Password1!';
const PASSWORD_WITHOUT_SPECIAL = 'Password1';

// Mirrors the controller: opaque tokens are stored and compared as SHA-256.
const hashToken = (token) =>
  require('crypto').createHash('sha256').update(token).digest('hex');
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
    // clearAllMocks resets recorded calls but NOT the mockResolvedValueOnce
    // queue, so unconsumed responses leak into the next test.
    db.query.mockReset();
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

    it('should return 400 when the password has no special character', async () => {
      const res = await makeRequest('POST', '/api/auth/register', {
        email: 'test@student.com',
        password: PASSWORD_WITHOUT_SPECIAL,
        role: 'student',
        full_name: 'Test'
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/special character/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const hash = await bcrypt.hash(VALID_PASSWORD, 10);
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1, email: 'test@student.com', password_hash: hash, role: 'student',
            is_active: true, is_banned: false,
            // login now refuses unverified accounts and branches on skip_otp
            is_email_verified: true, skip_otp: true
          }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'test@student.com',
        password: VALID_PASSWORD
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should return 403 when the email is not verified', async () => {
      const hash = await bcrypt.hash(VALID_PASSWORD, 10);
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1, email: 'test@student.com', password_hash: hash, role: 'student',
          is_active: true, is_banned: false,
          is_email_verified: false, skip_otp: true
        }]
      });

      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'test@student.com',
        password: VALID_PASSWORD
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('should return 401 with invalid password', async () => {
      const hash = await bcrypt.hash('OtherPass1', 10);
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@student.com', password_hash: hash, role: 'student', is_active: true, is_banned: false, is_email_verified: true }]
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
      // The controller signs the refresh token with JWT_REFRESH_SECRET, or
      // JWT_SECRET + '-refresh' when that is unset, and verifies with the
      // same expression. The test has to sign it the same way.
      const refreshSecret = process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}-refresh`;
      const refreshToken = jwt.sign({ userId: 1 }, refreshSecret, { expiresIn: '7d' });
      // Sessions store the SHA-256 of the refresh token, so the lookup value
      // is the hash. Mocking the raw token can never match.
      const refreshTokenHash = hashToken(refreshToken);
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10, refresh_token_hash: refreshTokenHash }] })
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
      // authenticate runs the user lookup AND the session-exists check before
      // getMe queries the profile.
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@student.com', role: 'student', is_active: true, is_banned: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 'session-1' }] })
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
