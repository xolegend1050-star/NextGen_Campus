jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const db = require('../src/config/database');
const { canTransition, transitionVerification, VALID_TRANSITIONS } = require('../src/utils/verificationStateMachine');

describe('Verification State Machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canTransition', () => {
    it('should allow pending → approved', () => {
      expect(canTransition('pending', 'approved')).toBe(true);
    });

    it('should allow pending → rejected', () => {
      expect(canTransition('pending', 'rejected')).toBe(true);
    });

    it('should allow pending → expired', () => {
      expect(canTransition('pending', 'expired')).toBe(true);
    });

    it('should allow rejected → pending (resubmit)', () => {
      expect(canTransition('rejected', 'pending')).toBe(true);
    });

    it('should allow expired → pending (resubmit)', () => {
      expect(canTransition('expired', 'pending')).toBe(true);
    });

    it('should allow approved → expired', () => {
      expect(canTransition('approved', 'expired')).toBe(true);
    });

    it('should reject approved → rejected', () => {
      expect(canTransition('approved', 'rejected')).toBe(false);
    });

    it('should reject approved → pending', () => {
      expect(canTransition('approved', 'pending')).toBe(false);
    });

    it('should reject rejected → approved', () => {
      expect(canTransition('rejected', 'approved')).toBe(false);
    });

    it('should reject rejected → expired', () => {
      expect(canTransition('rejected', 'expired')).toBe(false);
    });

    it('should reject expired → approved', () => {
      expect(canTransition('expired', 'approved')).toBe(false);
    });

    it('should reject expired → rejected', () => {
      expect(canTransition('expired', 'rejected')).toBe(false);
    });

    it('should reject same-state transitions (pending → pending)', () => {
      expect(canTransition('pending', 'pending')).toBe(false);
    });

    it('should reject invalid status values', () => {
      expect(canTransition('invalid', 'approved')).toBe(false);
      expect(canTransition('pending', 'invalid')).toBe(false);
    });
  });

  describe('VALID_TRANSITIONS', () => {
    it('should have exactly 4 valid starting states', () => {
      expect(Object.keys(VALID_TRANSITIONS)).toHaveLength(4);
    });

    it('should define transitions for pending, rejected, expired, approved', () => {
      expect(VALID_TRANSITIONS.pending).toBeDefined();
      expect(VALID_TRANSITIONS.rejected).toBeDefined();
      expect(VALID_TRANSITIONS.expired).toBeDefined();
      expect(VALID_TRANSITIONS.approved).toBeDefined();
    });
  });

  describe('transitionVerification', () => {
    it('should transition from pending to approved', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 'v1', status: 'pending', verification_type: 'college_email' }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await transitionVerification(db, 'v1', 'approved', 'admin1');
      expect(result.status).toBe('approved');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should transition from pending to rejected with reason', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 'v1', status: 'pending', verification_type: 'id_card' }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await transitionVerification(db, 'v1', 'rejected', 'admin1', 'Blurry image');
      expect(result.status).toBe('rejected');
      expect(result.rejection_reason).toBe('Blurry image');
    });

    it('should throw error for verification not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(transitionVerification(db, 'nonexistent', 'approved'))
        .rejects.toThrow('Verification not found');
    });

    it('should throw error for invalid transition (approved → rejected)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'v1', status: 'approved', verification_type: 'college_email' }]
      });

      await expect(transitionVerification(db, 'v1', 'rejected'))
        .rejects.toThrow('Invalid transition: approved → rejected');
    });

    it('should throw error for invalid transition (rejected → approved)', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'v1', status: 'rejected', verification_type: 'id_card' }]
      });

      await expect(transitionVerification(db, 'v1', 'approved'))
        .rejects.toThrow('Invalid transition: rejected → approved');
    });

    it('should allow resubmission (rejected → pending)', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 'v1', status: 'rejected', verification_type: 'college_email' }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await transitionVerification(db, 'v1', 'pending');
      expect(result.status).toBe('pending');
    });
  });
});
