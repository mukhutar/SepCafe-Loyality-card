// NEW firebase.js — no direct Firestore access

export function normalisePhone(raw) {
  const digits = raw.replace(/[\s\-().]/g, '');
  return digits.startsWith('+') ? digits : '+' + digits;
}

async function post(endpoint, body) {
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const getCustomer       = (phone) => post('get-customer', { phone });
export const addStamp          = (phone) => post('add-stamp',    { phone });
export const getOrCreateCustomer = (phone) => post('add-stamp',  { phone }); // add-stamp already handles creation