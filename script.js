/**
 * FX Convert — script.js
 * Handles: currency list, conversion via PHP API, history, UI interactions
 */

// ─── Currency List ────────────────────────────────────────────────────────────
const CURRENCIES = {
  USD: "US Dollar",        EUR: "Euro",              GBP: "British Pound",
  JPY: "Japanese Yen",     AUD: "Australian Dollar", CAD: "Canadian Dollar",
  CHF: "Swiss Franc",      CNY: "Chinese Yuan",      INR: "Indian Rupee",
  BDT: "Bangladeshi Taka", MXN: "Mexican Peso",      BRL: "Brazilian Real",
  KRW: "South Korean Won", SGD: "Singapore Dollar",  HKD: "Hong Kong Dollar",
  NOK: "Norwegian Krone",  SEK: "Swedish Krona",     DKK: "Danish Krone",
  NZD: "New Zealand Dollar", ZAR: "South African Rand",
  AED: "UAE Dirham",       SAR: "Saudi Riyal",       TRY: "Turkish Lira",
  THB: "Thai Baht",        IDR: "Indonesian Rupiah",  MYR: "Malaysian Ringgit",
  PHP: "Philippine Peso",  PKR: "Pakistani Rupee",   EGP: "Egyptian Pound",
  PLN: "Polish Zloty",     CZK: "Czech Koruna",      HUF: "Hungarian Forint",
};

// ─── DOM References ───────────────────────────────────────────────────────────
const amountInput    = document.getElementById('amount');
const fromSelect     = document.getElementById('fromCurrency');
const toSelect       = document.getElementById('toCurrency');
const swapBtn        = document.getElementById('swapBtn');
const convertBtn     = document.getElementById('convertBtn');
const resultAmount   = document.getElementById('resultAmount');
const resultMeta     = document.getElementById('resultMeta');
const resultBox      = document.getElementById('resultBox');
const rateInfo       = document.getElementById('rateInfo');
const rateTicker     = document.getElementById('rateTicker');
const historySection = document.getElementById('historySection');
const historyBody    = document.getElementById('historyBody');
const clearHistoryBtn= document.getElementById('clearHistory');

// ─── State ────────────────────────────────────────────────────────────────────
let history = JSON.parse(localStorage.getItem('fx_history') || '[]');

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  populateSelects();
  renderHistory();
  loadTicker();

  convertBtn.addEventListener('click', handleConvert);
  swapBtn.addEventListener('click', handleSwap);
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Convert on Enter key
  amountInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleConvert();
  });
}

// ─── Populate Selects ─────────────────────────────────────────────────────────
function populateSelects() {
  Object.entries(CURRENCIES).forEach(([code, name]) => {
    const optFrom = new Option(`${code} — ${name}`, code);
    const optTo   = new Option(`${code} — ${name}`, code);
    fromSelect.add(optFrom);
    toSelect.add(optTo);
  });
  fromSelect.value = 'USD';
  toSelect.value   = 'BDT';
}

// ─── Handle Convert ───────────────────────────────────────────────────────────
async function handleConvert() {
  const amount = parseFloat(amountInput.value);
  const from   = fromSelect.value;
  const to     = toSelect.value;

  // Validate
  if (isNaN(amount) || amount <= 0) {
    showError('Please enter a valid positive amount.');
    return;
  }
  if (from === to) {
    showResult(amount, from, to, 1.0);
    return;
  }

  setLoading(true);

  try {
    const data = await fetchConversion(amount, from, to);
    if (data.error) {
      showError(data.error);
    } else {
      showResult(amount, from, to, data.rate, data.result);
      addHistory({ amount, from, to, result: data.result, rate: data.rate });
    }
  } catch (err) {
    showError('Network error. Please try again.');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// ─── Fetch from PHP Backend ───────────────────────────────────────────────────
async function fetchConversion(amount, from, to) {
  const formData = new FormData();
  formData.append('amount', amount);
  formData.append('from',   from);
  formData.append('to',     to);

  const response = await fetch('convert.php', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ─── Show Result ──────────────────────────────────────────────────────────────
function showResult(amount, from, to, rate, result) {
  const converted = result !== undefined ? result : amount * rate;

  resultBox.classList.remove('error');
  resultBox.classList.add('has-result');
  resultAmount.textContent = `${formatNumber(converted)} ${to}`;
  resultMeta.textContent   = `${formatNumber(amount)} ${from} = ${formatNumber(converted)} ${to}`;
  rateInfo.textContent     = `1 ${from} = ${rate.toFixed(6)} ${to}`;

  // Animate
  resultAmount.style.transform = 'scale(0.95)';
  setTimeout(() => { resultAmount.style.transform = 'scale(1)'; }, 150);
}

// ─── Show Error ───────────────────────────────────────────────────────────────
function showError(msg) {
  resultBox.classList.add('error');
  resultBox.classList.remove('has-result');
  resultAmount.textContent = msg;
  resultMeta.textContent   = '';
  rateInfo.textContent     = '';
}

// ─── Loading State ────────────────────────────────────────────────────────────
function setLoading(state) {
  convertBtn.classList.toggle('loading', state);
  convertBtn.querySelector('.btn-text').textContent = state ? 'Converting…' : 'Convert';
}

// ─── Swap Currencies ─────────────────────────────────────────────────────────
function handleSwap() {
  [fromSelect.value, toSelect.value] = [toSelect.value, fromSelect.value];
}

// ─── History ──────────────────────────────────────────────────────────────────
function addHistory(entry) {
  entry.time = new Date().toLocaleTimeString();
  history.unshift(entry);
  if (history.length > 20) history.pop(); // max 20 entries
  localStorage.setItem('fx_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) {
    historySection.style.display = 'none';
    return;
  }
  historySection.style.display = 'block';
  historyBody.innerHTML = history.map(e => `
    <tr>
      <td>${formatNumber(e.amount)}</td>
      <td>${e.from}</td>
      <td>${e.to}</td>
      <td class="result-cell">${formatNumber(e.result)}</td>
      <td>${e.rate.toFixed(4)}</td>
      <td>${e.time}</td>
    </tr>
  `).join('');
}

function clearHistory() {
  history = [];
  localStorage.removeItem('fx_history');
  renderHistory();
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
async function loadTicker() {
  try {
    const pairs = ['USD/EUR','USD/GBP','USD/JPY','USD/BDT','USD/INR','USD/CAD'];
    const res   = await fetch('convert.php?ticker=1');
    const data  = await res.json();

    if (data.rates) {
      const text = pairs.map(p => {
        const to   = p.split('/')[1];
        const rate = data.rates[to];
        return rate ? `${p}: ${rate.toFixed(4)}` : null;
      }).filter(Boolean).join('   ·   ');

      rateTicker.innerHTML = `<span class="ticker-label">Live Rates</span> ${text}`;
    }
  } catch {
    rateTicker.innerHTML = '<span class="ticker-label">Rates</span> Could not load ticker.';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatNumber(n) {
  if (n === undefined || n === null) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
