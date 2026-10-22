/**
 * Wakes the two free-tier Render services before they fall asleep.
 *
 * Render's free web services spin down after about fifteen minutes with no
 * traffic, and waking one takes thirty to ninety seconds. Every page that
 * reaches a cold service feels broken rather than merely slow, and this
 * application has two of them: the Node API and the Python AI service. The
 * student dashboard asks the API to proxy a request to the AI service, so a
 * cold page can pay for two boots in series.
 *
 * Pinging /health roughly every ten minutes stops either one from sleeping.
 * The pings are free and this script costs nothing to run, which is the point:
 * the obvious Render-native answer is a cron job, and a cron job has a minimum
 * charge of one dollar a month.
 *
 * Two ways to run it, neither of which costs anything:
 *
 *   1. A free external monitor. UptimeRobot's free tier allows fifty monitors
 *      at a five minute interval, which is comfortably inside the fifteen
 *      minute window. Point two monitors at the two /health URLs below and
 *      delete this script if you prefer -- that is the better option if the
 *      machine that would run this one is usually switched off.
 *
 *   2. A scheduled task on your own machine, which needs no signup at all:
 *
 *        schtasks /create /tn "NextGen keep-alive" /sc minute /mo 10 ^
 *          /tr "node C:\Users\<you>\NextGen_Campus\backend\scripts\keep-alive.js"
 *
 *      The trade-off is that it only works while that machine is on, so it is
 *      the right choice for a demo and the wrong one for anything that has to
 *      stay reachable.
 *
 * /health is the correct thing to wake it with. It does not touch the database,
 * so it succeeds even when the database is the part that is down, and a ping
 * therefore cannot be mistaken for evidence that the application is healthy.
 *
 *   node scripts/keep-alive.js
 */

const ENDPOINTS = [
  {
    name: 'API',
    url: process.env.KEEP_ALIVE_API ||
      'https://nextgen-campus-api.onrender.com/health',
  },
  {
    name: 'AI service',
    url: process.env.KEEP_ALIVE_AI ||
      'https://nextgen-campus-ai.onrender.com/health',
  },
];

const WAKE_TIMEOUT_MS = 120000;   // a cold boot can take this long
const IDLE_TIMEOUT_MS = 15000;    // an awake service should answer well inside this

const check = async ({ name, url }) => {
  const started = Date.now();
  // A cold service is exactly the case this script exists to handle, so the
  // request is given long enough to wait one out rather than timing out
  // alongside the thing it was meant to prevent.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const ms = Date.now() - started;
    const ok = res.ok;
    const note = ms > IDLE_TIMEOUT_MS
      ? 'was asleep and has been woken'
      : 'was already awake';
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(12)} ${String(ms).padStart(6)}ms  ${note}`);
    return ok;
  } catch (err) {
    const ms = Date.now() - started;
    console.log(`  FAIL  ${name.padEnd(12)} ${String(ms).padStart(6)}ms  ${err.name === 'AbortError' ? 'did not finish within ' + WAKE_TIMEOUT_MS + 'ms' : err.message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
};

(async () => {
  console.log(`  keep-alive at ${new Date().toISOString()}`);
  const results = await Promise.all(ENDPOINTS.map(check));
  const failed = results.filter((r) => !r).length;
  if (failed) {
    console.log(`  ${failed} of ${results.length} service(s) did not answer`);
    process.exitCode = 1;
  }
  process.exit();
})().catch((err) => {
  console.error('  keep-alive failed:', err.message);
  process.exit(1);
});
