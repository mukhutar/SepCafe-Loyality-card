// ─────────────────────────────────────────────
//  barista.js  –  PIN → Lookup → Stamp flow
// ─────────────────────────────────────────────

import { normalisePhone, getCustomer, addStamp } from './firebase.js';
import { buildCircles, updateProgress } from './customer.js';

const BARISTA_PIN = '7913';

let pinBuffer    = '';
let currentPhone = '';   // holds phone OR email depending on lookup mode
let lookupMode   = 'phone'; // 'phone' | 'email'
let isStamping   = false;

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showAlert(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.add('show');
}
function hideAlert(elId) {
  document.getElementById(elId).classList.remove('show');
}

// ── PIN logic ─────────────────────────────────
function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

function pinPress(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 4) checkPin();
}

function pinDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
  hideAlert('pin-error');
}

function checkPin() {
  if (pinBuffer === BARISTA_PIN) {
    goTo('s-lookup');
    document.getElementById('lookup-input').focus();
  } else {
    showAlert('pin-error', 'Incorrect PIN. Try again.');
    setTimeout(() => {
      pinBuffer = '';
      updatePinDots();
      hideAlert('pin-error');
    }, 1200);
  }
}

// ── Lookup mode toggle ────────────────────────
function setLookupMode(mode) {
  lookupMode = mode;
  const input  = document.getElementById('lookup-input');
  const label  = document.getElementById('lookup-label');
  const phoneBtn = document.getElementById('toggle-phone');
  const emailBtn = document.getElementById('toggle-email');

  hideAlert('lookup-error');
  input.value = '';

  if (mode === 'phone') {
    input.type        = 'tel';
    input.placeholder = '+968 9X XXX XXXX';
    label.textContent = 'Customer phone';
    phoneBtn.classList.add('active');
    emailBtn.classList.remove('active');
  } else {
    input.type        = 'email';
    input.placeholder = 'customer@gmail.com';
    label.textContent = 'Customer Gmail';
    emailBtn.classList.add('active');
    phoneBtn.classList.remove('active');
  }

  input.focus();
}

// ── Customer lookup ───────────────────────────
async function lookupCustomer() {
  const raw = document.getElementById('lookup-input').value.trim();

  if (!raw) {
    showAlert('lookup-error', lookupMode === 'phone'
      ? 'Enter a valid phone number.'
      : 'Enter a valid Gmail address.');
    return;
  }

  let identifier;

  if (lookupMode === 'phone') {
    identifier = normalisePhone(raw);
    if (identifier.length < 8) {
      showAlert('lookup-error', 'Enter a valid phone number with country code.');
      return;
    }
  } else {
    // basic email validation
    if (!raw.includes('@') || !raw.includes('.')) {
      showAlert('lookup-error', 'Enter a valid email address.');
      return;
    }
    identifier = raw.toLowerCase();
  }

  hideAlert('lookup-error');
  const btn = document.getElementById('lookup-btn');
  btn.disabled = true;
  btn.textContent = 'Looking up…';

  try {
    // For phone: use existing get-customer endpoint
    // For email: use get-customer-google endpoint
    let customer;
    if (lookupMode === 'phone') {
      customer = await getCustomer(identifier);
    } else {
      customer = await getGoogleCustomer(identifier);
    }

    if (!customer) {
      showAlert('lookup-error', lookupMode === 'phone'
        ? 'No customer found with that number. They need to register via the customer page.'
        : 'No customer found with that Gmail. They need to sign in via the customer page first.');
      return;
    }

    currentPhone = identifier;
    renderStampPanel(customer, lookupMode);
    goTo('s-stamp');
  } catch (err) {
    showAlert('lookup-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Look up customer';
  }
}

// ── Fetch Google customer from Netlify ────────
async function getGoogleCustomer(email) {
  const res = await fetch('/.netlify/functions/get-customer-google', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, name: '' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lookup failed');
  return data;
}

// ── Stamp panel render ────────────────────────
function renderStampPanel(customer, mode) {
  const identifier = customer.phone || customer.email || '';
  document.getElementById('stamp-phone').textContent = identifier;

  // Show badge indicating auth type
  const badge = document.getElementById('auth-badge');
  badge.textContent = mode === 'email' ? '✉️ Google account' : '📱 Phone account';

  buildCircles('stamp-circles', customer.stamps);
  updateProgress('s-progress-fill', 's-progress-text', customer.stamps);

  const infoEl = document.getElementById('stamp-status');
  const btn    = document.getElementById('stamp-btn');

  if (customer.stamps >= 5) {
    infoEl.textContent = '🎉 Free drink ready to redeem! Tap below to confirm and reset their card.';
    btn.textContent    = 'Redeem free drink & reset card';
  } else {
    const left = 5 - customer.stamps;
    infoEl.textContent = `${left} more purchase${left > 1 ? 's' : ''} until their free drink.`;
    btn.textContent    = 'Confirm purchase — add stamp';
  }
}

// ── Add stamp ─────────────────────────────────
async function doStamp() {
  if (isStamping) return;
  isStamping = true;

  const btn = document.getElementById('stamp-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    let updated;

    if (lookupMode === 'phone') {
      updated = await addStamp(currentPhone);
    } else {
      // Call a google-specific add-stamp endpoint
      updated = await addStampGoogle(currentPhone);
    }

    renderStampPanel(updated, lookupMode);

    if (updated.justUnlocked) {
      document.getElementById('stamp-status').textContent =
        '🎉 Free drink just unlocked! Customer can redeem on their next visit.';
    } else if (updated.redeemed) {
      document.getElementById('stamp-status').textContent =
        '✓ Free drink redeemed. Card reset — new cycle started!';
    }
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    isStamping = false;
    btn.disabled = false;
  }
}

// ── Add stamp for Google customer ─────────────
async function addStampGoogle(email) {
  const res = await fetch('/.netlify/functions/add-stamp-google', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Stamp failed');
  return data;
}

// ── Boot ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // PIN pad
  document.querySelectorAll('.pin-key[data-digit]').forEach(key => {
    key.addEventListener('click', () => pinPress(key.dataset.digit));
  });
  document.getElementById('pin-del').addEventListener('click', pinDelete);

  // Keyboard PIN entry
  document.addEventListener('keydown', e => {
    const screen = document.querySelector('.screen.active');
    if (!screen || screen.id !== 's-pin') return;
    if (/^\d$/.test(e.key)) pinPress(e.key);
    if (e.key === 'Backspace') pinDelete();
  });

  // Lookup mode toggle
  document.getElementById('toggle-phone').addEventListener('click', () => setLookupMode('phone'));
  document.getElementById('toggle-email').addEventListener('click', () => setLookupMode('email'));

  // Lookup
  document.getElementById('lookup-btn').addEventListener('click', lookupCustomer);
  document.getElementById('lookup-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupCustomer();
  });

  // Stamp
  document.getElementById('stamp-btn').addEventListener('click', doStamp);

  // Navigation
  document.getElementById('back-to-lookup').addEventListener('click', () => {
    document.getElementById('lookup-input').value = '';
    hideAlert('lookup-error');
    goTo('s-lookup');
  });
  document.getElementById('back-to-pin').addEventListener('click', () => {
    pinBuffer = '';
    updatePinDots();
    goTo('s-pin');
  });
});
