-- Fix demo accounts: ensure all seeded users have skip_otp = true
-- This is needed because the original seed script didn't set skip_otp,
-- and company demo accounts were broken (required OTP).

-- Set skip_otp for ALL demo accounts (students, alumni, company, admin)
UPDATE users SET skip_otp = true WHERE email IN (
  'admin@nextgencampus.com',
  'sujal@student.com', 'priya@student.com', 'rahul@student.com', 'ananya@student.com',
  'mentor1@alumni.com', 'mentor2@alumni.com', 'mentor3@alumni.com',
  'hr@techstartup.com', 'talent@codecraft.com'
);
