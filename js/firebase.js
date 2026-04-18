
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey:            "AIzaSyAQ9IHebvkjYV3SqJbEC7mTZrYdBgLRWII",
  authDomain:        "sep-cafe-loyalty.firebaseapp.com",
  projectId:         "sep-cafe-loyalty",
  storageBucket:     "sep-cafe-loyalty.firebasestorage.app",
  messagingSenderId: "361690067078",
  appId:             "1:361690067078:web:00e12af56ca4749836a107"
};
// ────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);


export function normalisePhone(raw) {
  return raw.replace(/[\s\-().]/g, '');
}


export async function getCustomer(phone) {
  const ref  = doc(db, 'customers', phone);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}


export async function createCustomer(phone) {
  const ref = doc(db, 'customers', phone);
  const data = {
    phone,
    stamps:      0,  
    totalDrinks: 0,   
    freeEarned:  0,  
    createdAt:   serverTimestamp(),
    lastVisit:   serverTimestamp()
  };
  await setDoc(ref, data);
  return data;
}


export async function getOrCreateCustomer(phone) {
  const existing = await getCustomer(phone);
  if (existing) return existing;
  return createCustomer(phone);
}


export async function addStamp(phone) {
  const customer = await getCustomer(phone);
  if (!customer) throw new Error('Customer not found');

  const ref = doc(db, 'customers', phone);

  if (customer.stamps >= 5) {
    
    await updateDoc(ref, {
      stamps:     0,
      freeEarned: increment(1),
      lastVisit:  serverTimestamp()
    });
    return { ...customer, stamps: 0, freeEarned: customer.freeEarned + 1, redeemed: true };
  } else {
    const newStamps = customer.stamps + 1;
    await updateDoc(ref, {
      stamps:      newStamps,
      totalDrinks: increment(1),
      lastVisit:   serverTimestamp()
    });
    const updated = { ...customer, stamps: newStamps, totalDrinks: customer.totalDrinks + 1 };
    if (newStamps === 5) updated.justUnlocked = true;
    return updated;
  }
}
