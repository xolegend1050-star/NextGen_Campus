require('dotenv').config();
const {Pool} = require('pg');
const p = new Pool({connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized: false}, family: 4, connectionTimeoutMillis: 10000});
p.query("SELECT email, role, skip_otp, is_email_verified FROM users WHERE email IN ('xolegend1050@gmail.com', 'renukaborhade902@gmail.com', 'harshitap2003@gmail.com', 'talent@codecraft.com', 'hr@techstartup.com', 'mentor2@alumni.com', 'mentor3@alumni.com', 'priya@student.com', 'rahul@student.com', 'ananya@student.com') ORDER BY role, email").then(r => {
  r.rows.forEach(u => console.log(u.email.padEnd(35), u.role.padEnd(10), 'skip_otp:', String(u.skip_otp).padEnd(6), 'verified:', u.is_email_verified));
  p.end();
}).catch(e => { console.log('ERR:', e.message); p.end(); });
