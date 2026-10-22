jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

const db = require('../src/config/database');
const { getMentorById, getMentors } = require('../src/controllers/mentorship/mentorshipController');

/**
 * The mentor detail page could never load. It fetched the whole mentor list with
 * limit=100 while the validator caps limit at 50, so every request came back 400;
 * the error was swallowed in the browser and the page said "Mentor not found" for
 * mentors that were sitting in the database. Nothing in the suite exercised this
 * controller at all, so the broken path was invisible from here too.
 */
describe('mentorship getMentorById', () => {
  beforeEach(() => jest.clearAllMocks());

  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  });

  const row = { id: 'm1', full_name: 'Neha Kulkarni', bio: 'ML Engineer' };

  it('returns the mentor when the id matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });
    const res = makeRes();

    await getMentorById({ params: { mentorId: 'm1' } }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ mentor: row });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 404 rather than an empty body when no mentor has that id', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = makeRes();

    await getMentorById({ params: { mentorId: 'nope' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Mentor not found' });
  });

  it('selects by id with no paging, which is what made the list lookup fragile', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });

    await getMentorById({ params: { mentorId: 'abc' } }, makeRes(), jest.fn());

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('WHERE u.id = $1');
    expect(sql).not.toMatch(/\bLIMIT\b/i);
    expect(sql).not.toMatch(/\bOFFSET\b/i);
    expect(params).toEqual(['abc']);
  });

  it('carries the same columns as the list, so the detail view reads no undefined field', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });

    await getMentorById({ params: { mentorId: 'm1' } }, makeRes(), jest.fn());

    const sql = db.query.mock.calls[0][0];
    [
      'p.full_name', 'p.avatar_url', 'p.bio', 'p.city', 'p.college_name',
      'p.skills', 'p.trust_score', 'ap.current_company',
      'ap.mentorship_areas', 'avg_rating', 'sessions_completed'
    ].forEach((col) => expect(sql).toContain(col));
  });

  it('applies the same availability conditions as the list, so a hidden mentor stays hidden', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] });

    await getMentorById({ params: { mentorId: 'm1' } }, makeRes(), jest.fn());

    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain("u.role = 'alumni'");
    expect(sql).toContain('u.is_active = true');
    expect(sql).toContain('u.is_banned = false');
    expect(sql).toContain('ap.mentoring_available = true');
  });

  it('passes database errors to the error handler instead of swallowing them', async () => {
    const boom = new Error('connection lost');
    db.query.mockRejectedValueOnce(boom);
    const next = jest.fn();

    await getMentorById({ params: { mentorId: 'm1' } }, makeRes(), next);

    expect(next).toHaveBeenCalledWith(boom);
  });
});

describe('mentorship getMentors', () => {
  beforeEach(() => jest.clearAllMocks());

  it('still pages, so the list keeps its own contract', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = { json: jest.fn() };
    await getMentors({ query: { page: 1, limit: 12 } }, res, jest.fn());

    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/\bLIMIT\b/);
    expect(res.json.mock.calls[0][0].pagination.limit).toBe(12);
  });
});
