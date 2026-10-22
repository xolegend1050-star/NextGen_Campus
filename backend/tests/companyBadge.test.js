jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const db = require('../src/config/database');
const { syncCompanyBadge, COMPANY_TYPES } = require('../src/utils/companyBadge');

/**
 * The badge column that gig listings and the trust endpoint read was never
 * written by anything. The verification flow stopped at verifications.status,
 * so a company could clear both checks and still not be marked verified. These
 * tests pin the two halves of the fix: the badge follows the pair rather than a
 * single check, and it can be taken away again.
 */
describe('companyBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const approvedTypes = (types) => ({
    rows: types.map((t) => ({ verification_type: t }))
  });

  it('recognises exactly the two company verification types', () => {
    expect(COMPANY_TYPES).toEqual(['company_domain', 'company_gst']);
  });

  it('earns the badge once both the domain and the document are approved', async () => {
    db.query
      .mockResolvedValueOnce(approvedTypes(['company_domain', 'company_gst']))
      .mockResolvedValueOnce({ rows: [] })   // UPDATE company_profiles
      .mockResolvedValueOnce({ rows: [{ id: 'b1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const earned = await syncCompanyBadge(db, 'u1');

    expect(earned).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE company_profiles'),
      [true, 'u1']
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_badges'),
      ['u1', 'b1']
    );
  });

  it('does not earn the badge from the document alone', async () => {
    db.query
      .mockResolvedValueOnce(approvedTypes(['company_gst']))
      .mockResolvedValueOnce({ rows: [] });

    const earned = await syncCompanyBadge(db, 'u1');

    expect(earned).toBe(false);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE company_profiles'),
      [false, 'u1']
    );
    // No badge row is written for a partial pair.
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_badges'),
      expect.anything()
    );
  });

  it('does not earn the badge from the domain alone', async () => {
    db.query
      .mockResolvedValueOnce(approvedTypes(['company_domain']))
      .mockResolvedValueOnce({ rows: [] });

    expect(await syncCompanyBadge(db, 'u1')).toBe(false);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE company_profiles'),
      [false, 'u1']
    );
  });

  it('revokes the badge when a previously approved verification is no longer approved', async () => {
    db.query
      .mockResolvedValueOnce(approvedTypes(['company_domain']))
      .mockResolvedValueOnce({ rows: [] });

    const earned = await syncCompanyBadge(db, 'u1');

    expect(earned).toBe(false);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE company_profiles'),
      [false, 'u1']
    );
  });

  it('counts only rows that are actually approved, ignoring pending ones', async () => {
    // The SQL filters on status = 'approved'; this asserts the filter is there,
    // because a query that merely selected every row would award the badge on
    // submission and reproduce the original hole.
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await syncCompanyBadge(db, 'u1');

    const select = db.query.mock.calls[0][0];
    expect(select).toContain("status = 'approved'");
    expect(select).toContain('verification_type');
  });

  it('still marks the profile verified when the badge row does not exist yet', async () => {
    db.query
      .mockResolvedValueOnce(approvedTypes(['company_domain', 'company_gst']))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });   // no matching row in badges

    const earned = await syncCompanyBadge(db, 'u1');

    expect(earned).toBe(true);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE company_profiles'),
      [true, 'u1']
    );
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_badges'),
      expect.anything()
    );
  });

  it('does not write anything when there is no user id', async () => {
    expect(await syncCompanyBadge(db, null)).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('is idempotent, so approving twice cannot duplicate the badge', async () => {
    db.query
      .mockResolvedValueOnce(approvedTypes(['company_domain', 'company_gst']))
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'b1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await syncCompanyBadge(db, 'u1');

    const insert = db.query.mock.calls[3][0];
    expect(insert).toContain('ON CONFLICT DO NOTHING');
  });
});
