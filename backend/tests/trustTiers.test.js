jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const db = require('../src/config/database');
const { TIERS, POINTS, getTier, calculateDecay, awardPoints, recalculateTrustScore } = require('../src/utils/trustTiers');

describe('Trust Score System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTier', () => {
    it('should return "New" tier for score 0', () => {
      const tier = getTier(0);
      expect(tier.label).toBe('New');
      expect(tier.min).toBe(0);
      expect(tier.max).toBe(29);
    });

    it('should return "New" tier for score 29', () => {
      expect(getTier(29).label).toBe('New');
    });

    it('should return "Rising" tier for score 30', () => {
      const tier = getTier(30);
      expect(tier.label).toBe('Rising');
      expect(tier.min).toBe(30);
      expect(tier.max).toBe(69);
    });

    it('should return "Rising" tier for score 69', () => {
      expect(getTier(69).label).toBe('Rising');
    });

    it('should return "Featured" tier for score 70', () => {
      const tier = getTier(70);
      expect(tier.label).toBe('Featured');
      expect(tier.min).toBe(70);
    });

    it('should return "Featured" tier for score 200', () => {
      expect(getTier(200).label).toBe('Featured');
    });

    it('should handle negative score gracefully (New tier)', () => {
      expect(getTier(-5).label).toBe('New');
    });
  });

  describe('calculateDecay', () => {
    it('should return 0 for null lastActiveAt', () => {
      expect(calculateDecay(null)).toBe(0);
    });

    it('should return 0 within grace period (30 days)', () => {
      const recent = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      expect(calculateDecay(recent)).toBe(0);
    });

    it('should return 0 at exactly 30 days (grace boundary)', () => {
      const exactly30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(calculateDecay(exactly30)).toBe(0);
    });

    it('should calculate decay after grace period (2 pts/day)', () => {
      const daysInactive = 40; // 10 days past grace
      const pastDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
      const decay = calculateDecay(pastDate);
      expect(decay).toBe(10 * 2); // 10 decay days × 2 pts/day
    });

    it('should calculate decay for 60 days inactive (60 pts)', () => {
      const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const decay = calculateDecay(pastDate);
      expect(decay).toBe(30 * 2); // 30 decay days × 2 pts/day
    });

    it('should handle very old dates (large decay)', () => {
      const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year
      const decay = calculateDecay(oldDate);
      expect(decay).toBe((365 - 30) * 2);
    });
  });

  describe('TIERS', () => {
    it('should define all three tiers', () => {
      expect(TIERS.new).toBeDefined();
      expect(TIERS.rising).toBeDefined();
      expect(TIERS.featured).toBeDefined();
    });

    it('should have correct tier boundaries', () => {
      expect(TIERS.new.min).toBe(0);
      expect(TIERS.new.max).toBe(29);
      expect(TIERS.rising.min).toBe(30);
      expect(TIERS.rising.max).toBe(69);
      expect(TIERS.featured.min).toBe(70);
    });
  });

  describe('POINTS', () => {
    it('should have verification_approved points for all types', () => {
      expect(POINTS.verification_approved.student_college_email).toBe(25);
      expect(POINTS.verification_approved.student_id_card).toBe(25);
      expect(POINTS.verification_approved.alumni_linkedin).toBe(35);
      expect(POINTS.verification_approved.alumni_college_id).toBe(35);
      expect(POINTS.verification_approved.company_domain).toBe(50);
      expect(POINTS.verification_approved.company_gst).toBe(50);
    });

    it('should have correct action points', () => {
      expect(POINTS.doubt_posted).toBe(5);
      expect(POINTS.doubt_answered).toBe(10);
      expect(POINTS.answer_accepted).toBe(20);
      expect(POINTS.gig_completed).toBe(30);
      expect(POINTS.mentor_session_completed).toBe(25);
      expect(POINTS.profile_completed).toBe(10);
    });
  });

  describe('awardPoints', () => {
    it('should award points and update score', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 10 }] }) // get current score
        .mockResolvedValueOnce({ rows: [] }) // update score
        .mockResolvedValueOnce({ rows: [] }); // insert history

      const result = await awardPoints('user1', 'doubt_posted');
      expect(result.points).toBe(5);
      expect(result.oldScore).toBe(10);
      expect(result.score).toBe(15);
      expect(result.tier).toBe('New');
    });

    it('should cap score at 200', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 195 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await awardPoints('user1', 'gig_completed'); // 30 pts
      expect(result.score).toBe(200);
      expect(result.points).toBe(30);
    });

    it('should return null for unknown action type', async () => {
      const result = await awardPoints('user1', 'unknown_action');
      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await awardPoints('nonexistent', 'doubt_posted');
      expect(result).toBeNull();
    });

    it('should handle verification-specific points', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await awardPoints('user1', 'verification_approved', 'student_college_email');
      expect(result.points).toBe(25);
      expect(result.score).toBe(25);
      expect(result.tier).toBe('New');
    });

    it('should transition tier from New to Rising', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 25 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await awardPoints('user1', 'gig_completed'); // 25 + 30 = 55
      expect(result.score).toBe(55);
      expect(result.tier).toBe('Rising');
    });

    it('should transition tier from Rising to Featured', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 60 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await awardPoints('user1', 'gig_completed'); // 60 + 30 = 90
      expect(result.score).toBe(90);
      expect(result.tier).toBe('Featured');
    });
  });

  describe('recalculateTrustScore', () => {
    it('should return null if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await recalculateTrustScore('nonexistent');
      expect(result).toBeNull();
    });

    it('should calculate score from history with no decay', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 50, last_active_at: new Date() }] }) // profile
        .mockResolvedValueOnce({ rows: [{ total_earned: '50' }] }); // history sum

      const result = await recalculateTrustScore('user1');
      expect(result.score).toBe(50);
      expect(result.decay).toBe(0);
    });

    it('should apply decay for inactive user', async () => {
      const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 50, last_active_at: pastDate }] })
        .mockResolvedValueOnce({ rows: [{ total_earned: '50' }] })
        .mockResolvedValueOnce({ rows: [{ total_earned: '50' }] })
        .mockResolvedValueOnce({ rows: [] }); // decay history insert

      const result = await recalculateTrustScore('user1');
      expect(result.decay).toBe(60); // (60-30) * 2
      expect(result.score).toBe(0); // max(0, 50-60)
    });

    it('should not go below 0 after decay', async () => {
      const pastDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 10, last_active_at: pastDate }] })
        .mockResolvedValueOnce({ rows: [{ total_earned: '10' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await recalculateTrustScore('user1');
      expect(result.score).toBe(0);
    });

    it('should not update DB if score unchanged', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ trust_score: 50, last_active_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ total_earned: '50' }] });

      const result = await recalculateTrustScore('user1');
      expect(result.score).toBe(50);
      // Only 2 queries (no update query)
      expect(db.query).toHaveBeenCalledTimes(2);
    });
  });
});
