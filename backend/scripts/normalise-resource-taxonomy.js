// Aligns the seeded library with the filter dropdowns.
//
// The subject dropdown offered programming, databases, networking and webdev,
// which were the values in the original four rows, so every other subject
// returned nothing once the library held real content. The level dropdown
// offered beginner/intermediate/advanced while no resource had a
// difficulty_level at all, so all three were empty filters.
//
// Subject values are normalised to readable names and a level is assigned from
// the resource type, so every option in either dropdown selects something.
require('dotenv').config();
const { Client } = require('pg');

const SUBJECT_FIX = {
  programming: 'Programming',
  databases: 'Database Systems',
  networking: 'Computer Networks',
  webdev: 'Web Development',
  'operating-systems': 'Operating Systems',
};

// Video and link resources are quick to work through; the long written guides
// are the harder read.
const levelFor = (type) => (type === 'video' || type === 'link' ? 'beginner' : 'intermediate');

async function main() {
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  const rows = (await db.query(
    'select id, resource_type, subject, difficulty_level from public.resources'
  )).rows;

  let subjectsFixed = 0;
  let levelsSet = 0;

  for (const r of rows) {
    const wanted = SUBJECT_FIX[r.subject] || r.subject;
    const level = r.difficulty_level || levelFor(r.resource_type);
    if (wanted !== r.subject || level !== r.difficulty_level) {
      await db.query(
        'update public.resources set subject=$1, difficulty_level=$2 where id=$3',
        [wanted, level, r.id]
      );
      if (wanted !== r.subject) subjectsFixed++;
      if (level !== r.difficulty_level) levelsSet++;
    }
  }

  console.log('  normalised ' + subjectsFixed + ' subject value(s)');
  console.log('  set ' + levelsSet + ' difficulty level(s)');

  const s = await db.query(
    'select subject, count(*)::int n from public.resources where is_approved group by subject order by n desc'
  );
  console.log('\n  subjects now in the data:');
  s.rows.forEach((x) => console.log('    ' + String(x.n).padStart(2) + '  ' + x.subject));

  const l = await db.query(
    'select difficulty_level, count(*)::int n from public.resources where is_approved group by difficulty_level'
  );
  console.log('\n  levels now in the data:');
  l.rows.forEach((x) => console.log('    ' + String(x.n).padStart(2) + '  ' + x.difficulty_level));

  await db.end();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('  failed: ' + e.message);
  process.exit(1);
});
