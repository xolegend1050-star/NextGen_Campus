/**
 * Keeps `company_profiles.is_verified` in step with a company's verifications.
 *
 * Everything that shows a company as trustworthy reads this column: gig listings
 * show it as `company_verified`, the trust endpoint returns it as `isVerified`,
 * and login sends it back as `is_verified`. Nothing ever wrote it. The
 * verification flow updated `verifications.status` and stopped there, so a
 * company could clear both checks and still never be marked verified anywhere.
 * The only thing that ever set the column was the database seed.
 *
 * The badge is awarded for the pair, not for one of them. The page asks for two
 * and counts 0/2, so awarding on either alone would let a company that uploaded
 * a GST certificate it never proved control of the matching domain display as
 * verified.
 *
 * It is recomputed from the rows each time rather than toggled, because the same
 * helper runs when a link is clicked and when an admin reviews: whichever way a
 * verification changes, the badge ends up matching what is actually approved.
 * Rejection and expiry therefore take the badge away again.
 *
 *   const { syncCompanyBadge } = require('../utils/companyBadge');
 *   await syncCompanyBadge(db, userId);
 */

const COMPANY_TYPES = ['company_domain', 'company_gst'];

const syncCompanyBadge = async (db, userId) => {
  if (!userId) return false;

  const approved = await db.query(
    `SELECT DISTINCT verification_type
       FROM verifications
      WHERE user_id = $1
        AND verification_type = ANY($2)
        AND status = 'approved'`,
    [userId, COMPANY_TYPES]
  );

  const earned = approved.rows.length === COMPANY_TYPES.length;

  await db.query(
    `UPDATE company_profiles
        SET is_verified = $1
      WHERE user_id = $2`,
    [earned, userId]
  );

  // The badge row is what the profile shows; company_profiles.is_verified is what
  // gigs and the trust endpoint read. They are separate stores, so earning the
  // badge means writing both, and it is written idempotently so that approving a
  // third time cannot create a duplicate row.
  if (earned) {
    const badge = await db.query(
      `SELECT id FROM badges WHERE name = 'Verified Company'`
    );
    if (badge.rows.length > 0) {
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, badge.rows[0].id]
      );
    }
  }

  return earned;
};

module.exports = { syncCompanyBadge, COMPANY_TYPES };
