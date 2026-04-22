// ─────────────────────────────────────────────
//  firebase.js  –  app init + helpers
// ─────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQ9IHebvkjYV3SqJbEC7mTZrYdBgLRWII",
  authDomain: "sep-cafe-loyalty.firebaseapp.com",
  projectId: "sep-cafe-loyalty",
  storageBucket: "sep-cafe-loyalty.firebasestorage.app",
  messagingSenderId: "361690067078",
  appId: "1:361690067078:web:00e12af56ca4749836a107"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ── phone normaliser ──────────────────────────
export function normalisePhone(raw) {
  const digits = raw.replace(/[\s\-().]/g, '');
  return digits.startsWith('+') ? digits : '+' + digits;
}

// ── Netlify backend calls ─────────────────────
async function post(endpoint, body) {
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${endpoint} failed`);
  return data;
}

export const getOrCreateCustomer = (phone) => post('get-customer', { phone });
export const addStamp            = (phone) => post('add-stamp',    { phone });
export const getCustomer         = (phone) => post('get-customer', { phone });