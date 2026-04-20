const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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

  try {
    const { phone } = JSON.parse(event.body);
    if (!phone) return { statusCode: 400, body: JSON.stringify({ error: 'Phone required' }) };

    const ref  = db.collection('customers').doc(phone);
    const snap = await ref.get();

    // ── Create customer if they don't exist yet ──
    if (!snap.exists) {
      const newCustomer = {
        phone,
        stamps:      0,
        totalDrinks: 0,
        freeEarned:  0,
        createdAt:   FieldValue.serverTimestamp(),
        lastVisit:   FieldValue.serverTimestamp(),
      };
      await ref.set(newCustomer);
      return { statusCode: 200, body: JSON.stringify(newCustomer) };
    }

    return { statusCode: 200, body: JSON.stringify(snap.data()) };

  } catch (err) {
    console.error('get-customer error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
