// ─────────────────────────────────────────────
//  customer.js  –  Firebase Phone Auth flow
// ─────────────────────────────────────────────

import {
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { auth, getOrCreateCustomer } from './firebase.js';

let confirmationResult = null;
let currentPhone       = '';

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

// ── reCAPTCHA setup ───────────────────────────
function setupRecaptcha() {
  if (window.recaptchaVerifier) return;

  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'normal',
    callback: () => {},
    'expired-callback': () => {
      showError('phone-error', 'reCAPTCHA expired. Please verify again.');
      window.recaptchaVerifier = null;
      setupRecaptcha();
    }
  });

  window.recaptchaVerifier.render();
}

// ── step 1: send OTP via Firebase ─────────────
async function sendOTP() {
  const raw   = document.getElementById('phone-input').value.trim();
  const phone = raw.startsWith('+') ? raw.replace(/[\s\-().]/g, '') : '+' + raw.replace(/[\s\-().]/g, '');

  if (phone.length < 8) {
    showError('phone-error', 'Please enter a valid phone number with country code.');
    return;
  }

  hideError('phone-error');
  const btn = document.getElementById('send-otp-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    currentPhone = phone;

    goTo('s-otp');
    document.getElementById('otp-phone-display').textContent = phone;
    focusOTPBox('o1');
  } catch (err) {
    console.error('sendOTP error:', err);
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.render().then(widgetId => {
        grecaptcha.reset(widgetId);
      });
    }
    showError('phone-error', err.message || 'Failed to send code. Check your number and try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send code via SMS';
  }
}

// ── step 2: verify OTP ────────────────────────
function getOTPValue() {
  return ['o1','o2','o3','o4','o5','o6'].map(id => document.getElementById(id).value).join('');
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
  if (getOTPValue().length === 6) verifyOTP();
}

async function verifyOTP() {
  const code = getOTPValue();
  if (code.length < 6) return;

  hideError('otp-error');
  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  try {
    await confirmationResult.confirm(code);

    const customer = await getOrCreateCustomer(currentPhone);
    localStorage.setItem('sep_phone', currentPhone);
    localStorage.setItem('sep_customer', JSON.stringify(customer));
    renderCard(customer);
    goTo('s-card');
  } catch (err) {
    console.error('verifyOTP error:', err);
    showError('otp-error', 'Incorrect code. Please try again.');
    ['o1','o2','o3','o4','o5','o6'].forEach(id => { document.getElementById(id).value = ''; });
    focusOTPBox('o1');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

// ── render card ───────────────────────────────
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

// ── boot ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  const savedPhone    = localStorage.getItem('sep_phone');
  const savedCustomer = localStorage.getItem('sep_customer');

  if (savedPhone && savedCustomer) {
    // Render immediately from cache
    currentPhone = savedPhone;
    renderCard(JSON.parse(savedCustomer));
    goTo('s-card');

    // Refresh silently in background to get latest stamps
    try {
      const fresh = await getOrCreateCustomer(savedPhone);
      localStorage.setItem('sep_customer', JSON.stringify(fresh));
      renderCard(fresh);
    } catch (err) {
      console.warn('Background refresh failed, showing cached data:', err);
    }
  }

  // init reCAPTCHA on page load
  setupRecaptcha();

  document.getElementById('send-otp-btn').addEventListener('click', sendOTP);
  document.getElementById('phone-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendOTP();
  });

  document.getElementById('o1').addEventListener('input',   e => otpInput(e, 'o2'));
  document.getElementById('o2').addEventListener('input',   e => otpInput(e, 'o3'));
  document.getElementById('o2').addEventListener('keydown', e => otpKeyDown(e, 'o1'));
  document.getElementById('o3').addEventListener('input',   e => otpInput(e, 'o4'));
  document.getElementById('o3').addEventListener('keydown', e => otpKeyDown(e, 'o2'));
  document.getElementById('o4').addEventListener('input',   e => otpInput(e, 'o5'));
  document.getElementById('o4').addEventListener('keydown', e => otpKeyDown(e, 'o3'));
  document.getElementById('o5').addEventListener('input',   e => otpInput(e, 'o6'));
  document.getElementById('o5').addEventListener('keydown', e => otpKeyDown(e, 'o4'));
  document.getElementById('o6').addEventListener('input',   e => otpInput(e, null));
  document.getElementById('o6').addEventListener('keydown', e => otpKeyDown(e, 'o5'));

  document.getElementById('verify-btn').addEventListener('click', verifyOTP);
  document.getElementById('back-to-phone').addEventListener('click', () => goTo('s-phone'));

  document.getElementById('logout-btn').addEventListener('click', () => {
    currentPhone = '';
    localStorage.removeItem('sep_phone');
    localStorage.removeItem('sep_customer');
    document.getElementById('phone-input').value = '';
    goTo('s-phone');
  });
});