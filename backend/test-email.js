require('dotenv').config();
const sgMail = require('@sendgrid/mail');

async function testEmail() {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.error('SENDGRID_API_KEY not set in .env file');
    process.exit(1);
  }

  console.log('API Key found:', apiKey.substring(0, 10) + '...');

  sgMail.setApiKey(apiKey);

  const msg = {
    to: 'renukaborhade902@gmail.com', // Test email
    from: 'NextGen Campus <noreply@nextgencampus.com>',
    subject: 'Test Email - NextGen Campus',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">Email Test Successful!</h2>
        <p>If you received this email, SendGrid is working correctly.</p>
        <p style="color: #666;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `
  };

  try {
    console.log('Sending test email...');
    await sgMail.send(msg);
    console.log('Email sent successfully!');
    console.log('Check renukaborhade902@gmail.com inbox');
  } catch (error) {
    console.error('Failed to send email:');
    console.error(error.response ? error.response.body : error.message);
  }
}

testEmail();
