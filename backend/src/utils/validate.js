/**
 * Parameter validation helpers.
 *
 * Malformed ids reached Postgres directly and produced
 * "invalid input syntax for type uuid" with a 500, which both leaked a
 * database error to the client and let a caller probe column types. These are
 * used by the routes so a bad parameter is a 400 before any query runs.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

const badRequest = (res, message) => res.status(400).json({ error: message });

/**
 * Validate every :param in req.params as a UUID.
 * Returns true when the request may continue.
 */
const requireUuidParams = (req, res, ...names) => {
  for (const name of names) {
    if (!isUuid(req.params[name])) {
      badRequest(res, `Invalid ${name}: must be a UUID`);
      return false;
    }
  }
  return true;
};

/** Validate numeric query values such as page and limit. */
const requireIntQuery = (req, res, ...names) => {
  for (const name of names) {
    if (req.query[name] === undefined) continue;
    const raw = String(req.query[name]);
    if (!/^-?\d+$/.test(raw)) {
      badRequest(res, `Invalid ${name}: must be an integer`);
      return false;
    }
  }
  return true;
};

/** Clamp a numeric query value into a sane range, falling back to a default. */
const intQuery = (value, fallback, min, max) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

/**
 * Build Express middleware requiring the named route params to be UUIDs.
 * Usage: router.get('/:id', authenticate, uuidParams('id'), handler)
 */
const uuidParams = (...names) => (req, res, next) => {
  for (const name of names) {
    if (!isUuid(req.params[name])) {
      return badRequest(res, `Invalid ${name}: must be a UUID`);
    }
  }
  return next();
};

/**
 * Build middleware requiring numeric query values that are also in range.
 *
 * Checking only that the value is an integer was not enough: page=0 and
 * page=-5 are integers, but they produce a negative OFFSET, which Postgres
 * rejects, so the request still came back as a 500.
 *
 * Usage: intQueries('page', 'limit')   - page >= 1, limit 1..100
 *        intQueries('limit', 1, 500)  - custom bounds
 */
const DEFAULT_INT_BOUNDS = { page: [1, 1000000], limit: [1, 100] };

const intQueries = (...args) => {
  const bounds = args[args.length - 1];
  const names =
    typeof bounds === 'object' && bounds !== null && !Array.isArray(bounds)
      ? Object.keys(bounds)
      : args.filter((a) => typeof a === 'string');
  const custom = typeof bounds === 'object' && bounds !== null && !Array.isArray(bounds) ? bounds : {};

  return (req, res, next) => {
    for (const name of names) {
      if (req.query[name] === undefined) continue;
      const raw = String(req.query[name]);
      if (!/^-?\d+$/.test(raw)) {
        return badRequest(res, `Invalid ${name}: must be an integer`);
      }
      const [min, max] = custom[name] || DEFAULT_INT_BOUNDS[name] || [1, 1000000];
      const n = parseInt(raw, 10);
      if (n < min || n > max) {
        return badRequest(res, `Invalid ${name}: must be between ${min} and ${max}`);
      }
    }
    return next();
  };
};

/**
 * Validate a skill name path param. Skills are stored as plain strings in
 * profiles.skills (a text[]), so this is a length/charset check rather than a
 * UUID check.
 */
const skillNameParam = (req, res, next) => {
  const skill = req.params.skill;
  if (typeof skill !== 'string' || !skill.trim() || skill.length > 50 || !/^[\w\s+#.\-/]+$/.test(skill)) {
    return badRequest(res, 'Invalid skill: use 1-50 letters, numbers, spaces or + # . - /');
  }
  return next();
};

module.exports = {
  isUuid,
  requireUuidParams,
  requireIntQuery,
  uuidParams,
  intQueries,
  skillNameParam,
  intQuery,
  badRequest,
  UUID_RE
};
