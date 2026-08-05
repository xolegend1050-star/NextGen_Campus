jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../src/utils/email', () => ({
  sendPasswordResetEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendOtpEmail: jest.fn().mockResolvedValue(true)
}));

const db = require('../src/config/database');
const { generateOtpCode, storeOtp, verifyOtp, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS } = require('../src/utils/otp');

describe('OTP System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateOtpCode', () => {
    it('should generate a 6-digit code', () => {
      const code = generateOtpCode();
      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateOtpCode());
      }
      // Should have high uniqueness (at least 90 unique out of 100)
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe('storeOtp', () => {
    it('should store OTP and return code with expiry', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Delete old OTPs
        .mockResolvedValueOnce({ rows: [] }); // Insert new OTP

      const result = await storeOtp('user1');

      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should delete old unverified OTPs before storing new one', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await storeOtp('user1');

      expect(db.query).toHaveBeenNthCalledWith(1,
        'DELETE FROM login_otps WHERE user_id = $1 AND verified = false',
        ['user1']
      );
    });
  });

  describe('verifyOtp', () => {
    it('should verify valid OTP successfully', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'otp1',
            otp_code: '123456',
            expires_at: futureDate,
            attempts: 0,
            max_attempts: 3,
            verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Increment attempts
        .mockResolvedValueOnce({ rows: [] }); // Mark verified

      const result = await verifyOtp('user1', '123456');

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user1');
    });

    it('should reject invalid OTP code', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'otp1',
            otp_code: '123456',
            expires_at: futureDate,
            attempts: 0,
            max_attempts: 3,
            verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Increment attempts

      const result = await verifyOtp('user1', '999999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid OTP');
      expect(result.error).toContain('2 attempts remaining');
    });

    it('should reject expired OTP', async () => {
      const pastDate = new Date(Date.now() - 5 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'otp1',
            otp_code: '123456',
            expires_at: pastDate,
            attempts: 0,
            max_attempts: 3,
            verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Delete expired

      const result = await verifyOtp('user1', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject after max attempts exceeded', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'otp1',
            otp_code: '123456',
            expires_at: futureDate,
            attempts: 3,
            max_attempts: 3,
            verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Delete after max attempts

      const result = await verifyOtp('user1', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
    });

    it('should return error when no OTP found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await verifyOtp('user1', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No OTP found');
    });

    it('should reject already verified OTP', async () => {
      const futureDate = new Date(Date.now() + 5 * 60 * 1000);
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'otp1',
          otp_code: '123456',
          expires_at: futureDate,
          attempts: 0,
          max_attempts: 3,
          verified: true
        }]
      });

      const result = await verifyOtp('user1', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already used');
    });
  });

  describe('Constants', () => {
    it('should have correct expiry time', () => {
      expect(OTP_EXPIRY_MINUTES).toBe(5);
    });

    it('should have correct max attempts', () => {
      expect(OTP_MAX_ATTEMPTS).toBe(3);
    });
  });
});
