// ─────────────────────────────────────────────
//  customer.js  –  Phone → OTP → Card flow
// ─────────────────────────────────────────────

import { normalisePhone, getOrCreateCustomer } from './firebase.js';

let currentPhone = '';

// ── screen navigation ─────────────────────────
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.add('show');
}
function hideError(elId) {
  document.getElementById(elId).classList.remove('show');
}


async function sendOTP() {
  const raw   = document.getElementById('phone-input').value.trim();
  const phone = normalisePhone(raw);

  if (phone.length < 8) {
    showError('phone-error', 'Please enter a valid WhatsApp number with country code.');
    return;
  }

  hideError('phone-error');
  const btn = document.getElementById('send-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const res  = await fetch('/.netlify/functions/send-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

    currentPhone = phone;
    goTo('s-otp');
    document.getElementById('otp-phone-display').textContent = phone;
    focusOTPBox('o1');
  } catch (err) {
    showError('phone-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send code on WhatsApp';
  }
}


function getOTPValue() {
  return ['o1','o2','o3','o4'].map(id => document.getElementById(id).value).join('');
}

function focusOTPBox(id) {
  setTimeout(() => { const el = document.getElementById(id); if (el) el.focus(); }, 80);
}

function otpKeyDown(e, prevId) {
  if (e.key === 'Backspace' && e.target.value === '' && prevId) {
    document.getElementById(prevId).focus();
  }
}

function otpInput(e, nextId) {
  const val = e.target.value.replace(/\D/g, '');
  e.target.value = val.slice(-1);
  if (val && nextId) document.getElementById(nextId).focus();
  if (getOTPValue().length === 4) verifyOTP();
}

async function verifyOTP() {
  const code = getOTPValue();
  if (code.length < 4) return;

  hideError('otp-error');
  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    const res  = await fetch('/.netlify/functions/verify-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone: currentPhone, code })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Incorrect code.');

    
    const customer = await getOrCreateCustomer(currentPhone);
    renderCard(customer);
    goTo('s-card');
  } catch (err) {
    showError('otp-error', err.message);
    ['o1','o2','o3','o4'].forEach(id => { document.getElementById(id).value = ''; });
    focusOTPBox('o1');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}


function renderCard(customer) {
  document.getElementById('card-phone').textContent = customer.phone;
  document.getElementById('info-phone').textContent  = customer.phone;
  document.getElementById('info-total').textContent  = customer.totalDrinks;
  document.getElementById('info-free').textContent   = customer.freeEarned;

  buildCircles('circles-container', customer.stamps);
  updateProgress('c-progress-fill', 'c-progress-text', customer.stamps);
}

export function buildCircles(containerId, stamps) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const circle = document.createElement('div');
    circle.className = 'stamp-circle' + (i < stamps ? ' stamped' : '');
    const mark = document.createElement('span');
    mark.className = 'stamp-mark';
    mark.textContent = '✦';
    circle.appendChild(mark);
    el.appendChild(circle);
  }

  
  const free = document.createElement('div');
  free.className = 'stamp-circle free-slot' + (stamps >= 5 ? ' earned' : '');
  const lbl = document.createElement('span');
  lbl.className = 'free-text';
  lbl.textContent = 'مجاناً';
  free.appendChild(lbl);
  el.appendChild(free);
}

export function updateProgress(fillId, textId, stamps) {
  const pct = Math.min((stamps / 5) * 100, 100);
  document.getElementById(fillId).style.width = pct + '%';
  document.getElementById(textId).textContent  = stamps + ' / 5 drinks';
}


document.addEventListener('DOMContentLoaded', () => {
  // Phone screen
  document.getElementById('send-otp-btn').addEventListener('click', sendOTP);
  document.getElementById('phone-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendOTP();
  });

  
  document.getElementById('o1').addEventListener('input',   e => otpInput(e, 'o2'));
  document.getElementById('o2').addEventListener('input',   e => otpInput(e, 'o3'));
  document.getElementById('o2').addEventListener('keydown', e => otpKeyDown(e, 'o1'));
  document.getElementById('o3').addEventListener('input',   e => otpInput(e, 'o4'));
  document.getElementById('o3').addEventListener('keydown', e => otpKeyDown(e, 'o2'));
  document.getElementById('o4').addEventListener('input',   e => otpInput(e, null));
  document.getElementById('o4').addEventListener('keydown', e => otpKeyDown(e, 'o3'));
  document.getElementById('verify-btn').addEventListener('click', verifyOTP);
  document.getElementById('back-to-phone').addEventListener('click', () => goTo('s-phone'));

  
  document.getElementById('logout-btn').addEventListener('click', () => {
    currentPhone = '';
    document.getElementById('phone-input').value = '';
    goTo('s-phone');
  });
});
