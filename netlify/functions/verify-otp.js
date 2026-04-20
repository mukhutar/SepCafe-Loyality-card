const admin            = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}
const db = getFirestore();

function normalisePhone(raw) {
  const digits = raw.replace(/[\s\-().]/g, '');
  return digits.startsWith('+') ? digits : '+' + digits;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    let phone, code;
    try {
      ({ phone, code } = JSON.parse(event.body));
      console.log('verify-otp called with phone:', phone, 'code:', code);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
    }

    if (!phone || !code) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Phone and code are required' }) };
    }

    phone = normalisePhone(phone);

    const ref  = db.collection('otps').doc(phone);
    const snap = await ref.get();

    if (!snap.exists) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No OTP found. Please request a new one.' }) };
    }

    const { otp, expires } = snap.data();

    if (Date.now() > expires) {
      await ref.delete();
      return { statusCode: 400, body: JSON.stringify({ error: 'Code expired. Please request a new one.' }) };
    }

    if (code !== otp) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Incorrect code. Please try again.' }) };
    }

    // Valid — delete OTP so it can't be reused
    await ref.delete();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, phone })
    };

  } catch (err) {
    console.error('verify-otp error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};