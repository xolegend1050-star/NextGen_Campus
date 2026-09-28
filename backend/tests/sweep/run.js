// Runs every sweep suite and prints a consolidated failure list
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const H = require('./harness');

(async () => {
  const suites = [
    require('./01-auth'),
    require('./02-features'),
    require('./03-admin')
  ];

  try {
    await H.seed();
    console.log(`\nSeeded ${Object.keys(H.users).filter(k => typeof H.users[k] === 'string').length} tokens`);
  } catch (e) {
    console.error('SEED FAILED:', e.message);
    process.exit(1);
  }

  for (const s of suites) {
    try {
      await s();
    } catch (e) {
      H.check(`suite ${s.name} crashed`, false, e.message);
      console.error(e.stack);
    }
  }

  const failed = H.summary();
  process.exit(failed.length ? 1 : 0);
})();
