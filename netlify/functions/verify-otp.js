
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore }                  = require('firebase-admin/firestore');

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

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let phone, code;
  try {
    ({ phone, code } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!phone || !code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Phone and code are required' }) };
  }

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
};
