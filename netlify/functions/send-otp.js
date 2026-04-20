// ─────────────────────────────────────────────
//  send-otp.js  –  Netlify serverless function
//
//  Generates a 4-digit OTP, stores it in memory
//  (Netlify function instances are ephemeral, so
//  for production use a KV store like Upstash Redis
//  or Firebase itself — see comment below),
//  then sends it via Twilio WhatsApp Sandbox.
//
//  Required environment variables (set in Netlify
//  dashboard → Site settings → Environment variables):
//
//    TWILIO_ACCOUNT_SID   your Twilio Account SID
//    TWILIO_AUTH_TOKEN    your Twilio Auth Token
//    TWILIO_WHATSAPP_FROM whatsapp:+14155238886  (sandbox number)
// ─────────────────────────────────────────────

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore }                  = require('firebase-admin/firestore');

// Initialise Firebase Admin once
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}
const db = getFirestore();

function generateOTP() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let phone;
  try {
    ({ phone } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!phone || phone.length < 8) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid phone number' }) };
  }

  const otp     = generateOTP();
  const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store OTP in Firestore (otp collection, doc = phone)
  await db.collection('otps').doc(phone).set({ otp, expires });
  console.log('OTP stored for phone:', phone);

  // Send via Twilio WhatsApp
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_WHATSAPP_FROM; 

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const body = new URLSearchParams({
    From: from,
    To:   `whatsapp:${phone}`,
    Body: `Your Sep Cafe verification code is: *${otp}*\n\nValid for 10 minutes.`
  });

  const response = await fetch(twilioUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    },
    body: body.toString()
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('Twilio error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send WhatsApp message. Check Twilio credentials.' })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'OTP sent via WhatsApp' })
  };
};
