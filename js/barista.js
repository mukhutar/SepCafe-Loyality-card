// ─────────────────────────────────────────────
//  barista.js  –  PIN → Lookup → Stamp flow
//


import { normalisePhone, getCustomer, addStamp } from './firebase.js';
import { buildCircles, updateProgress } from './customer.js';

const BARISTA_PIN = '7913'; 


let pinBuffer    = '';
let currentPhone = '';
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

async function lookupCustomer() {
  const raw   = document.getElementById('lookup-input').value.trim();
  const phone = normalisePhone(raw);

  if (phone.length < 8) {
    showAlert('lookup-error', 'Enter a valid phone number.');
    return;
  }

  hideAlert('lookup-error');
  const btn = document.getElementById('lookup-btn');
  btn.disabled = true;
  btn.textContent = 'Looking up…';

  try {
    const customer = await getCustomer(phone);
    if (!customer) {
      showAlert('lookup-error', 'No customer found with that number. They need to register first via the customer page.');
      return;
    }
    currentPhone = phone;
    renderStampPanel(customer);
    goTo('s-stamp');
  } catch (err) {
    showAlert('lookup-error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Look up customer';
  }
}


function renderStampPanel(customer) {
  document.getElementById('stamp-phone').textContent = customer.phone;
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

async function doStamp() {
  if (isStamping) return;
  isStamping = true;

  const btn = document.getElementById('stamp-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const updated = await addStamp(currentPhone);
    renderStampPanel(updated);

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


document.addEventListener('DOMContentLoaded', () => {
  // PIN pad keys
  document.querySelectorAll('.pin-key[data-digit]').forEach(key => {
    key.addEventListener('click', () => pinPress(key.dataset.digit));
  });
  document.getElementById('pin-del').addEventListener('click', pinDelete);

 
  document.addEventListener('keydown', e => {
    const screen = document.querySelector('.screen.active');
    if (!screen || screen.id !== 's-pin') return;
    if (/^\d$/.test(e.key)) pinPress(e.key);
    if (e.key === 'Backspace') pinDelete();
  });


  document.getElementById('lookup-btn').addEventListener('click', lookupCustomer);
  document.getElementById('lookup-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupCustomer();
  });

  document.getElementById('stamp-btn').addEventListener('click', doStamp);

  
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
