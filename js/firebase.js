
export function normalisePhone(raw) {
  const digits = raw.replace(/[\s\-().]/g, '');
  return digits.startsWith('+') ? digits : '+' + digits;
}

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

// Fetch customer (creates them if first time, no stamp added)
export const getOrCreateCustomer = (phone) => post('get-customer', { phone });

// Explicitly add a stamp — call this only when the barista taps "Add Stamp"
export const addStamp = (phone) => post('add-stamp', { phone });

// Fetch existing customer only
export const getCustomer = (phone) => post('get-customer', { phone });
