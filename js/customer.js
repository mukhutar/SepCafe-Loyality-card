// ─────────────────────────────────────────────
//  customer.js  –  Firebase Phone + Google Auth
// ─────────────────────────────────────────────

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { auth, googleProvider, getOrCreateCustomer, getOrCreateGoogleCustomer } from './firebase.js';

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

// ── Google Sign-In ────────────────────────────
async function signInWithGoogle() {
  const btn = document.getElementById('google-btn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user   = result.user;

    // Use email as the unique key for Google users
    const identifier = user.email;
    const name       = user.displayName || '';

    const customer = await getOrCreateGoogleCustomer(identifier, name);

    // Store locally
    localStorage.setItem('sep_phone',    identifier);
    localStorage.setItem('sep_customer', JSON.stringify(customer));
    localStorage.setItem('sep_auth_type', 'google');

    currentPhone = identifier;
    renderCard(customer);
    goTo('s-card');
  } catch (err) {
    console.error('Google sign-in error:', err);
    if (err.code !== 'auth/popup-closed-by-user') {
      showError('phone-error', 'Google sign-in failed. Please try again.');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:8px">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google`;
  }
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
    localStorage.setItem('sep_phone',     currentPhone);
    localStorage.setItem('sep_customer',  JSON.stringify(customer));
    localStorage.setItem('sep_auth_type', 'phone');
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
  const identifier = customer.phone || customer.email || '';
  document.getElementById('card-phone').textContent = identifier;
  document.getElementById('info-phone').textContent  = identifier;
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
    currentPhone = savedPhone;
    renderCard(JSON.parse(savedCustomer));
    goTo('s-card');

    // Refresh silently in background
    try {
      const authType = localStorage.getItem('sep_auth_type');
      const fresh = authType === 'google'
        ? await getOrCreateGoogleCustomer(savedPhone, '')
        : await getOrCreateCustomer(savedPhone);
      localStorage.setItem('sep_customer', JSON.stringify(fresh));
      renderCard(fresh);
    } catch (err) {
      console.warn('Background refresh failed, showing cached data:', err);
    }
  }

  // init reCAPTCHA on page load
  setupRecaptcha();

  // ── event listeners ──
  document.getElementById('google-btn').addEventListener('click', signInWithGoogle);
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
    localStorage.removeItem('sep_auth_type');
    document.getElementById('phone-input').value = '';
    goTo('s-phone');
  });
});
