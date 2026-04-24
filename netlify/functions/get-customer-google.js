

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
    const { email, name } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) };

    // Store Google users under "google_customers" collection keyed by email
    const ref  = db.collection('google_customers').doc(email);
    const snap = await ref.get();

    if (!snap.exists) {
      const newCustomer = {
        email,
        name:        name || '',
        stamps:      0,
        totalDrinks: 0,
        freeEarned:  0,
        authType:    'google',
        createdAt:   FieldValue.serverTimestamp(),
        lastVisit:   FieldValue.serverTimestamp(),
      };
      await ref.set(newCustomer);
      return { statusCode: 200, body: JSON.stringify(newCustomer) };
    }

    return { statusCode: 200, body: JSON.stringify(snap.data()) };

  } catch (err) {
    console.error('get-customer-google error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
