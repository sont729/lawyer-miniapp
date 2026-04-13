/* ============================================================
   SHARED UTILITIES - 법률 AI 미니앱
   ============================================================ */

// Telegram WebApp init
var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
}

/* ---------- Tax Config Loading ---------- */
var TAX_CONFIG = null;
var CONFIG_LOADED = false;

function loadTaxConfig(callback) {
  if (CONFIG_LOADED) { callback(); return; }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'tax-config.json?v=7', true);
  xhr.onload = function() {
    if (xhr.status === 200) {
      TAX_CONFIG = JSON.parse(xhr.responseText);
      CONFIG_LOADED = true;
      // Update INCOME_BRACKETS and GIFT_BRACKETS from config
      INCOME_BRACKETS = TAX_CONFIG.incomeTax.brackets.map(function(b) {
        return { limit: b.limit || Infinity, rate: b.rate, deduct: b.deduct };
      });
      GIFT_BRACKETS = TAX_CONFIG.giftTax.brackets.map(function(b) {
        return { limit: b.limit || Infinity, rate: b.rate, deduct: b.deduct };
      });
    }
    callback();
  };
  xhr.onerror = function() { callback(); }; // fallback to hardcoded
  xhr.send();
}

// Get config value with dot notation: getConfig('salary.insurance.nationalPension.monthlyCapBase')
function getConfig(path, defaultVal) {
  if (!TAX_CONFIG) return defaultVal;
  var parts = path.split('.');
  var val = TAX_CONFIG;
  for (var i = 0; i < parts.length; i++) {
    if (val === undefined || val === null) return defaultVal;
    val = val[parts[i]];
  }
  return (val !== undefined && val !== null) ? val : defaultVal;
}

// Get the law reference and effective year for display
function getLawRef(section) {
  var law = getConfig(section + '.law', '');
  var year = getConfig(section + '.effectiveYear', '');
  return year + '년 기준 (' + law + ')';
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

function resultBox(rows, disclaimerText, lawRef) {
  var disc = disclaimerText || '* 본 계산기는 일반적인 경우를 기준으로 한 추정치입니다. 특수한 상황은 반영되지 않으므로 정확한 결과는 전문가 상담을 권장합니다.';
  var ref = lawRef ? '<p class="law-ref">' + lawRef + '</p>' : '';
  return '<div class="result-box">' + rows.join('') +
    '<p class="disclaimer">' + disc + '</p>' + ref + '</div>';
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

// Menu Button(☰)으로 열리는 미니앱은 sendData가 동작하지 않으므로
// `t.me/<bot>?start=<code>` 딥링크로 우회한다. 코드가 없는(자유 텍스트) 케이스만 클립보드로 fallback.
var BOT_USERNAME = 'onda_lawyer_bot';

function openBotWithCode(startCode) {
  if (!tg) return false;
  try {
    tg.openTelegramLink('https://t.me/' + BOT_USERNAME + '?start=' + startCode);
    setTimeout(function() { try { tg.close(); } catch(e) {} }, 500);
    return true;
  } catch(e) { return false; }
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
  // 계산기 start 코드가 있으면 딥링크로 봇에 직접 전달 (Menu Button 호환)
  if (_consultCode && openBotWithCode(_consultCode)) return;
  // 코드 없는 케이스(자유 텍스트 + 추가질문)는 클립보드 fallback
  var userQ = document.getElementById('consult-input');
  if (userQ && userQ.value.trim()) {
    message += '\n\n추가 질문: ' + userQ.value.trim();
  }
  sendToChat(message);
}


var _FAQ_ROUTE = {
  '전세보증금을 돌려받으려면 어떻게 해야 하나요?': 'faq_jeonse',
  '부당해고를 당했는데 어떻게 대응해야 하나요?': 'faq_dismissal',
  '교통사고 합의금은 어떻게 산정하나요?': 'faq_accident',
  '이혼 시 재산분할은 어떻게 되나요?': 'faq_divorce',
  '상속포기는 언제까지 해야 하나요?': 'faq_inherit'
};

function goConsult(question) {
  var code = _FAQ_ROUTE[question];
  if (code && openBotWithCode(code)) return;
  sendToChat(question);
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



function tipBox(text) {
  return '<div class="tip-box">' + text + '</div>';
}

var _DOC_ROUTE = {
  '내용증명':'doc_content_cert','고소장':'doc_complaint','민사소장':'doc_civil',
  '합의서':'doc_settlement','근로계약서':'doc_labor','차용증':'doc_loan',
  '진정서':'doc_petition','이의신청서':'doc_objection','위임장':'doc_poa',
  '사직서':'doc_resign','경위서':'doc_incident','상속포기신고서':'doc_inherit_waiver',
  '부당해고구제신청서':'doc_unfair_dismiss','NDA (비밀유지계약서)':'doc_nda',
  '업무위탁계약서':'doc_service','분납요청서':'doc_installment','각서':'doc_pledge',
  '고소취하서':'doc_withdraw','답변서':'doc_answer','임대차계약서':'doc_lease',
  '이혼합의서':'doc_divorce'
};

function requestDoc(docName) {
  var code = _DOC_ROUTE[docName];
  if (code && openBotWithCode(code)) return;
  sendToChat(docName + ' 작성해주세요.');
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
  loadTaxConfig(function() {
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
});
