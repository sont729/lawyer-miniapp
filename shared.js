/* ============================================================
   SHARED UTILITIES - 법률 AI 미니앱
   ============================================================ */

// Telegram WebApp init
var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
}

/* ---------- Number Formatting ---------- */
function fmtWon(n) {
  n = Math.floor(n);
  if (n < 0) return '-' + fmtWon(-n);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseWon(s) {
  if (!s) return 0;
  var n = parseInt(String(s).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

// Auto-format input with commas
function fmtNum(el) {
  var pos = el.selectionStart;
  var oldLen = el.value.length;
  var raw = el.value.replace(/[^0-9]/g, '');
  if (raw === '') { el.value = ''; return; }
  el.value = fmtWon(parseInt(raw, 10));
  var newLen = el.value.length;
  var newPos = pos + (newLen - oldLen);
  if (newPos < 0) newPos = 0;
  el.setSelectionRange(newPos, newPos);
}

// Setup auto-comma on all numeric inputs
function setupCommaInputs() {
  document.querySelectorAll('input[data-comma]').forEach(function(el) {
    el.addEventListener('input', function() { fmtNum(this); });
  });
}

/* ---------- Date Utilities ---------- */
function dateDiffDays(d1, d2) {
  var a = new Date(d1), b = new Date(d2);
  return Math.floor((b - a) / 86400000);
}

function dateDiffYears(d1, d2) {
  var a = new Date(d1), b = new Date(d2);
  var y = b.getFullYear() - a.getFullYear();
  var m = b.getMonth() - a.getMonth();
  var d = b.getDate() - a.getDate();
  if (m < 0 || (m === 0 && d < 0)) y--;
  return Math.max(0, y);
}

/* ---------- Tax Bracket Functions ---------- */
// 2024년 귀속 기준 종합소득세율 (2023년 세법 개정 반영)
var INCOME_BRACKETS = [
  { limit: 14000000,    rate: 6,  deduct: 0 },
  { limit: 50000000,    rate: 15, deduct: 1260000 },
  { limit: 88000000,    rate: 24, deduct: 5760000 },
  { limit: 150000000,   rate: 35, deduct: 15440000 },
  { limit: 300000000,   rate: 38, deduct: 19940000 },
  { limit: 500000000,   rate: 40, deduct: 25940000 },
  { limit: 1000000000,  rate: 42, deduct: 35940000 },
  { limit: Infinity,    rate: 45, deduct: 65940000 }
];

function applyIncomeTax(taxable) {
  if (taxable <= 0) return { tax: 0, rate: 0, deduct: 0, bracket: '' };
  for (var i = 0; i < INCOME_BRACKETS.length; i++) {
    var b = INCOME_BRACKETS[i];
    if (taxable <= b.limit) {
      var tax = Math.floor(taxable * b.rate / 100) - b.deduct;
      if (tax < 0) tax = 0;
      var bracketLabel = (b.limit === Infinity ? '10억 초과' : fmtWon(b.limit) + '원 이하');
      return { tax: tax, rate: b.rate, deduct: b.deduct, bracket: bracketLabel };
    }
  }
  return { tax: 0, rate: 0, deduct: 0, bracket: '' };
}

var GIFT_BRACKETS = [
  { limit: 100000000,    rate: 10, deduct: 0 },
  { limit: 500000000,    rate: 20, deduct: 10000000 },
  { limit: 1000000000,   rate: 30, deduct: 60000000 },
  { limit: 3000000000,   rate: 40, deduct: 160000000 },
  { limit: Infinity,     rate: 50, deduct: 460000000 }
];

function applyGiftTax(taxable) {
  if (taxable <= 0) return { tax: 0, rate: 0, deduct: 0 };
  for (var i = 0; i < GIFT_BRACKETS.length; i++) {
    var b = GIFT_BRACKETS[i];
    if (taxable <= b.limit) {
      var tax = Math.floor(taxable * b.rate / 100) - b.deduct;
      if (tax < 0) tax = 0;
      return { tax: tax, rate: b.rate, deduct: b.deduct };
    }
  }
  return { tax: 0, rate: 0, deduct: 0 };
}

/* ---------- Result HTML Helpers ---------- */
function resultRow(label, value, cls) {
  if (!label && !value) return '<div class="result-row" style="border:none;padding:4px 0"></div>';
  return '<div class="result-row' + (cls ? ' ' + cls : '') + '"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>';
}

function resultBox(rows, disclaimerText) {
  var disc = disclaimerText || '* 실제 세액은 추가 공제/감면에 따라 달라질 수 있습니다. 정확한 세액은 세무사 상담을 권장합니다.';
  return '<div class="result-box">' + rows.join('') +
    '<p class="disclaimer">' + disc + '</p></div>';
}

function explanationBox(text) {
  return '<div class="explain-box" onclick="this.classList.toggle(\'open\')">' +
    '<div class="explain-title">설명 보기</div>' +
    '<div class="explain-body">' + text + '</div></div>';
}

var _consultMsg = '';
var BOT_USERNAME = 'onda_lawyer_bot';

// 클립보드 복사 (동기 방식 — 텔레그램 WebView 호환)
function copyToClip(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(ta);
}

// 토스트 메시지 표시
function showToast(msg) {
  var d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 24px;border-radius:24px;font-size:14px;z-index:9999;text-align:center;max-width:80%;';
  document.body.appendChild(d);
  setTimeout(function() { d.remove(); }, 2500);
}

function sendToChat(message) {
  copyToClip(message);
  if (tg) {
    showToast('📋 복사 완료! 채팅에 붙여넣기 하세요');
    setTimeout(function() { tg.close(); }, 1500);
  } else {
    alert('📋 클립보드에 복사되었습니다!\n텔레그램 봇 채팅에 붙여넣기 하세요.');
  }
}

var _consultCode = '';

function consultButton(message, startCode) {
  _consultMsg = message;
  _consultCode = startCode || '';
  return '<div class="consult-area">'
    + '<input type="text" id="consult-input" class="consult-input" placeholder="추가로 궁금한 점을 적어주세요 (선택)" />'
    + '<button class="btn-consult" onclick="doConsult()">💬 이 내용으로 상담하기</button>'
    + '</div>';
}

function doConsult() {
  var message = _consultMsg;
  if (!message) { alert('먼저 계산을 실행해주세요.'); return; }
  var userQ = document.getElementById('consult-input');
  if (userQ && userQ.value.trim()) {
    message += '\n\n추가 질문: ' + userQ.value.trim();
  }
  if (tg) {
    try { tg.sendData(message); } catch(e) { sendToChat(message); }
  } else {
    sendToChat(message);
  }
}

var FAQ_CODES = {
  '전세보증금을 돌려받으려면 어떻게 해야 하나요?': 'faq_jeonse',
  '부당해고를 당했는데 어떻게 대응해야 하나요?': 'faq_dismissal',
  '교통사고 합의금은 어떻게 산정하나요?': 'faq_accident',
  '이혼 시 재산분할은 어떻게 되나요?': 'faq_divorce',
  '상속포기는 언제까지 해야 하나요?': 'faq_inherit'
};

function goConsult(question) {
  if (tg) {
    try { tg.sendData(question); } catch(e) { sendToChat(question); }
  } else {
    sendToChat(question);
  }
}


/* ---------- Navigation ---------- */
function goBack() {
  window.location.href = 'index.html';
}

function goChat() {
  if (tg) {
    try { tg.close(); } catch(e) {}
  } else {
    alert('텔레그램 채팅으로 돌아갑니다.');
  }
}


var DOC_CODES = {
  '내용증명': 'doc_content_cert',
  '고소장': 'doc_complaint',
  '민사소장': 'doc_civil',
  '합의서': 'doc_settlement',
  '근로계약서': 'doc_labor',
  '차용증': 'doc_loan',
  '진정서': 'doc_petition',
  '이의신청서': 'doc_objection',
  '위임장': 'doc_poa',
  '사직서': 'doc_resign',
  '경위서': 'doc_incident',
  '상속포기신고서': 'doc_inherit_waiver',
  '부당해고구제신청서': 'doc_unfair_dismiss',
  'NDA (비밀유지계약서)': 'doc_nda',
  '업무위탁계약서': 'doc_service',
  '분납요청서': 'doc_installment',
  '각서': 'doc_pledge',
  '고소취하서': 'doc_withdraw',
  '답변서': 'doc_answer',
  '임대차계약서': 'doc_lease',
  '이혼합의서': 'doc_divorce'
};

function requestDoc(docName) {
  var msg = docName + ' 작성해주세요.';
  if (tg) {
    try { tg.sendData(msg); } catch(e) { sendToChat(msg); }
  } else {
    sendToChat(msg);
  }
}

/* ---------- Telegram Back Button ---------- */
function setupTelegramBackButton(isHome) {
  if (!tg) return;
  if (isHome) {
    tg.BackButton.hide();
  } else {
    tg.BackButton.show();
    tg.BackButton.onClick(function() {
      window.history.back();
    });
  }
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', function() {
  setupCommaInputs();
  // Apply Telegram theme
  if (tg && tg.themeParams) {
    var tp = tg.themeParams;
    var root = document.documentElement.style;
    if (tp.bg_color) root.setProperty('--bg', tp.bg_color);
    if (tp.text_color) root.setProperty('--text', tp.text_color);
    if (tp.hint_color) root.setProperty('--hint', tp.hint_color);
    if (tp.link_color) root.setProperty('--link', tp.link_color);
    if (tp.button_color) root.setProperty('--btn', tp.button_color);
    if (tp.button_text_color) root.setProperty('--btn-text', tp.button_text_color);
    if (tp.secondary_bg_color) root.setProperty('--secondary-bg', tp.secondary_bg_color);
  }
});
