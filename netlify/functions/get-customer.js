const admin = require('firebase-admin');
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

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { phone } = JSON.parse(event.body);
  if (!phone) return { statusCode: 400, body: JSON.stringify({ error: 'Phone required' }) };

  const snap = await db.collection('customers').doc(phone).get();
  if (!snap.exists) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Customer not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify(snap.data()) };
};