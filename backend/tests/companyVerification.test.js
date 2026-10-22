jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));
jest.mock('../src/utils/ocr', () => ({ analyzeIDCard: jest.fn() }));
jest.mock('../src/utils/email', () => ({
  sendVerificationEmail: jest.fn(() => Promise.resolve(true)),
  sendVerificationSubmittedEmail: jest.fn(() => Promise.resolve(true)),
  sendVerificationApprovedEmail: jest.fn(() => Promise.resolve(true)),
  sendVerificationRejectedEmail: jest.fn(() => Promise.resolve(true))
}));

const db = require('../src/config/database');
const { sendVerificationEmail, sendVerificationSubmittedEmail } = require('../src/utils/email');
const controller = require('../src/controllers/verification/verificationController');

/**
 * Two defects in one endpoint, both found by reading the code rather than by any
 * existing test:
 *
 *   1. company_domain was approved the instant it was submitted. The only check
 *      was that the address was not a free mail provider, so ceo@flipkart.com
 *      earned the domain half of the Verified Company badge without anyone ever
 *      opening that mailbox, while the interface claimed a link had been sent.
 *
 *   2. The token was stored raw while /api/auth/verify-email looks it up as
 *      sha256, so every link that was sent could never match its own row.
 *
 * Nothing caught either, because nothing here asserted that an email-based
 * verification must still be pending after submission.
 */
describe('verification submit', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    sendVerificationEmail.mockResolvedValue(true);
    sendVerificationSubmittedEmail.mockResolvedValue(true);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  });

  const run = async (body, user = { id: 'u1', role: 'company' }, res = makeRes()) => {
    const next = jest.fn();
    await controller.submitVerification({ user, body }, res, next);
    return { res, next };
  };

  const SQL = () => db.query.mock.calls.map((c) => String(c[0]));

  const companySubmission = () => ({
    verification_type: 'company_domain',
    metadata: { company_email: 'ceo@flipkart.com' }
  });

  const queueCompanyDb = () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // no pending duplicate
      .mockResolvedValueOnce({             // INSERT INTO verifications
        rows: [{ id: 'v1', verification_type: 'company_domain', status: 'pending' }]
      })
      .mockResolvedValueOnce({ rows: [] })  // INSERT INTO verification_tokens
      .mockResolvedValueOnce({ rows: [{ full_name: 'Acme' }] });
  };

  it('leaves a company domain verification pending instead of approving it', async () => {
    queueCompanyDb();
    const { res, next } = await run(companySubmission());

    expect(next).not.toHaveBeenCalled();
    expect(SQL().some((q) => /UPDATE verifications\s+SET status = 'approved'/i.test(q)))
      .toBe(false);
    expect(res.json.mock.calls[0][0].verification.status).toBe('pending');
  });

  it('sends the link rather than granting the badge on submission', async () => {
    queueCompanyDb();
    await run(companySubmission());

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'ceo@flipkart.com',
      expect.any(String)
    );
  });

  it('stores the token as sha256, which is what the click handler looks up', async () => {
    queueCompanyDb();
    await run(companySubmission());

    const tokenInsert = db.query.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO verification_tokens'));
    expect(tokenInsert).toBeDefined();

    const stored = tokenInsert[1][1];
    expect(stored).toMatch(/^[a-f0-9]{64}$/);   // sha256, not the 36 char uuid sent
    expect(stored).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('returns the link outside production so the flow can be demonstrated without mail', async () => {
    queueCompanyDb();
    const { res } = await run(companySubmission());

    const link = res.json.mock.calls[0][0].devLink;
    expect(link).toMatch(/\/verify-email\?token=/);
    // The token in the link is the raw one: storing the digest and returning the
    // digest would leave the requester with a link that cannot match itself.
    const raw = link.split('token=')[1];
    expect(raw).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('withholds the link in production, where returning it would defeat the check', async () => {
    process.env.NODE_ENV = 'production';
    queueCompanyDb();
    const { res } = await run(companySubmission());

    expect(res.json.mock.calls[0][0].devLink).toBeUndefined();
  });

  it('still rejects a free mail provider for a company address', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });   // pending duplicate check only
    const { res, next } = await run({
      verification_type: 'company_domain',
      metadata: { company_email: 'someone@gmail.com' }
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/company email/i);
  });

  it('rolls the submission back when the link cannot be sent, so a retry is possible', async () => {
    sendVerificationEmail.mockResolvedValue(false);
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'v1', status: 'pending' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { res, next } = await run(companySubmission());

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
    expect(SQL().some((q) => q.includes('DELETE FROM verifications'))).toBe(true);
  });

  it('hashes the student college email token too, which had the same defect', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'v2', status: 'pending' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Student' }] });

    await run(
      {
        verification_type: 'student_college_email',
        metadata: { college_email: 's@college.edu' }
      },
      { id: 'u3', role: 'student' }
    );

    const tokenInsert = db.query.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO verification_tokens'));
    expect(tokenInsert[1][1]).toMatch(/^[a-f0-9]{64}$/);
    expect(sendVerificationEmail).toHaveBeenCalledWith('s@college.edu', expect.any(String));
  });

  it('auto-approves the LinkedIn format check, which needs no inbox', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'v3', status: 'pending' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Alum' }] });

    await run(
      { verification_type: 'alumni_linkedin', metadata: { linkedin_url: 'https://linkedin.com/in/someone' } },
      { id: 'u2', role: 'alumni' }
    );

    expect(SQL().some((q) => /UPDATE verifications\s+SET status = 'approved'/i.test(q)))
      .toBe(true);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
