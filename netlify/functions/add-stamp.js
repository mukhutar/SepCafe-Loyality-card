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

  const { phone } = JSON.parse(event.body);
  if (!phone) return { statusCode: 400, body: JSON.stringify({ error: 'Phone required' }) };

  const ref  = db.collection('customers').doc(phone);
  const snap = await ref.get();

  // Create customer if they don't exist yet
  if (!snap.exists) {
    const newCustomer = {
      phone,
      stamps: 1,
      totalDrinks: 1,
      freeEarned: 0,
      createdAt: FieldValue.serverTimestamp(),
      lastVisit: FieldValue.serverTimestamp(),
    };
    await ref.set(newCustomer);
    return { statusCode: 200, body: JSON.stringify(newCustomer) };
  }

  const customer = snap.data();

  if (customer.stamps >= 5) {
    await ref.update({
      stamps: 0,
      freeEarned: FieldValue.increment(1),
      lastVisit: FieldValue.serverTimestamp(),
    });
    return { statusCode: 200, body: JSON.stringify({
      ...customer, stamps: 0, freeEarned: customer.freeEarned + 1, redeemed: true
    })};
  }

  const newStamps = customer.stamps + 1;
  await ref.update({
    stamps: newStamps,
    totalDrinks: FieldValue.increment(1),
    lastVisit: FieldValue.serverTimestamp(),
  });

  const updated = { ...customer, stamps: newStamps, totalDrinks: customer.totalDrinks + 1 };
  if (newStamps === 5) updated.justUnlocked = true;

  return { statusCode: 200, body: JSON.stringify(updated) };
};