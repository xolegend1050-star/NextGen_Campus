const axios = require('axios');
const logger = require('../utils/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

// A cold-started Python service on Render's free tier can take 30-60s to boot,
// so the default is generous, but it must still be finite. Without a timeout a
// single slow upstream call holds the Express request open indefinitely.
const DEFAULT_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS) || 30000;

// Recruitment predictions are cheap; keep their budget tighter.
const FAST_TIMEOUT = parseInt(process.env.AI_FAST_TIMEOUT_MS) || 12000;

const RETRIES = parseInt(process.env.AI_MAX_RETRIES ?? 2);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AiServiceError extends Error {
  constructor(message, { status = 503, code = 'AI_UNAVAILABLE', cause } = {}) {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}

const isWorthRetrying = (err) => {
  const code = err.code || '';
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;      // timeout
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EAI_AGAIN') return true;
  if (err.response) return err.response.status >= 500;                   // transient upstream
  return false;                                                           // 4xx will not fix itself
};

/**
 * POST to the AI service with a hard timeout and bounded retries.
 * Throws AiServiceError (carrying an HTTP status) once retries are exhausted.
 */
const post = async (endpoint, payload, { timeout = DEFAULT_TIMEOUT, retries = RETRIES } = {}) => {
  const url = `${AI_SERVICE_URL}${endpoint}`;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        timeout,
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (err) {
      lastError = err;

      const retryable = isWorthRetrying(err);
      if (!retryable || attempt === retries) break;

      const backoff = Math.min(2000, 300 * 2 ** attempt);
      logger.warn(
        `AI call ${endpoint} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${backoff}ms: ${err.message}`
      );
      await sleep(backoff);
    }
  }

  const timedOut = lastError.code === 'ECONNABORTED' || lastError.code === 'ETIMEDOUT';
  logger.error(
    `AI call ${endpoint} failed permanently: ${lastError.message}`,
    { code: lastError.code, status: lastError.response?.status }
  );

  throw new AiServiceError(
    timedOut ? 'AI service timed out' : 'AI service unavailable',
    {
      status: 504,
      code: timedOut ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
      cause: lastError
    }
  );
};

const health = async () => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    return { available: true, ...response.data };
  } catch (err) {
    return { available: false, error: err.message };
  }
};

module.exports = {
  post,
  health,
  AiServiceError,
  AI_SERVICE_URL,
  DEFAULT_TIMEOUT,
  FAST_TIMEOUT
};
