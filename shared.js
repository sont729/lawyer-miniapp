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
var INCOME_BRACKETS = [
  { limit: 12000000,    rate: 6,  deduct: 0 },
  { limit: 46000000,    rate: 15, deduct: 1080000 },
  { limit: 88000000,    rate: 24, deduct: 5220000 },
  { limit: 150000000,   rate: 35, deduct: 14900000 },
  { limit: 300000000,   rate: 38, deduct: 19400000 },
  { limit: 500000000,   rate: 40, deduct: 25400000 },
  { limit: 1000000000,  rate: 42, deduct: 35400000 },
  { limit: Infinity,    rate: 45, deduct: 65400000 }
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
function consultButton(message) {
  _consultMsg = message;
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
    tg.sendData(JSON.stringify({type: 'consult', text: message}));
  } else {
    // 브라우저 — prompt 창으로 확실하게 보여주기
    var w = window.open('', '_blank', 'width=400,height=500');
    if (w) {
      w.document.write('<html><head><meta charset="utf-8"><title>상담 내용</title></head><body style="font-family:sans-serif;padding:20px;white-space:pre-wrap;font-size:14px;line-height:1.6">'
        + '<h3 style="margin-bottom:12px">📋 아래 내용을 텔레그램 봇에 붙여넣기 하세요</h3>'
        + '<textarea style="width:100%;height:300px;font-size:13px;padding:10px;border:1px solid #ddd;border-radius:8px" onclick="this.select()">' + message.replace(/</g,'&lt;') + '</textarea>'
        + '<p style="color:#999;font-size:12px;margin-top:8px">텍스트를 클릭하면 전체 선택됩니다</p>'
        + '</body></html>');
    } else {
      prompt('아래 내용을 복사해서 텔레그램 봇에 붙여넣기 하세요:', message);
    }
  }
}

function goConsult(question) {
  if (tg) {
    tg.sendData(JSON.stringify({type: 'consult', text: question}));
  } else {
    var w = window.open('', '_blank', 'width=400,height=300');
    if (w) {
      w.document.write('<html><head><meta charset="utf-8"><title>상담 질문</title></head><body style="font-family:sans-serif;padding:20px">'
        + '<h3>📋 아래 질문을 텔레그램 봇에 붙여넣기 하세요</h3>'
        + '<textarea style="width:100%;height:100px;font-size:14px;padding:10px;border:1px solid #ddd;border-radius:8px" onclick="this.select()">' + question + '</textarea>'
        + '</body></html>');
    } else {
      prompt('아래 내용을 복사하세요:', question);
    }
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


function requestDoc(docName) {
  var message = docName + ' 작성해주세요.';
  if (tg) {
    tg.sendData(JSON.stringify({type: 'consult', text: message}));
  } else {
    var w = window.open('', '_blank', 'width=400,height=250');
    if (w) {
      w.document.write('<html><head><meta charset="utf-8"><title>문서 요청</title></head><body style="font-family:sans-serif;padding:20px">'
        + '<h3>📋 아래 내용을 텔레그램 봇에 붙여넣기 하세요</h3>'
        + '<textarea style="width:100%;height:60px;font-size:14px;padding:10px;border:1px solid #ddd;border-radius:8px" onclick="this.select()">' + message + '</textarea>'
        + '</body></html>');
    } else {
      prompt('아래 내용을 복사하세요:', message);
    }
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
