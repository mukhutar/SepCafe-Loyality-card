// netlify/functions/add-stamp-google.js
// Adds a stamp to a Google-authenticated customer (keyed by email)

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
    const { email } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) };

    const ref  = db.collection('google_customers').doc(email);
    const snap = await ref.get();

    if (!snap.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Customer not found' }) };
    }

    const data = snap.data();
    let { stamps = 0, totalDrinks = 0, freeEarned = 0 } = data;

    let justUnlocked = false;
    let redeemed     = false;

    if (stamps >= 5) {
      // Redeem free drink and reset
      stamps      = 0;
      freeEarned += 1;
      redeemed    = true;
    } else {
      stamps      += 1;
      totalDrinks += 1;
      if (stamps === 5) justUnlocked = true;
    }

    await ref.update({
      stamps,
      totalDrinks,
      freeEarned,
      lastVisit: FieldValue.serverTimestamp(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ...data,
        stamps,
        totalDrinks,
        freeEarned,
        justUnlocked,
        redeemed,
      }),
    };

  } catch (err) {
    console.error('add-stamp-google error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
