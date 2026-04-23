/* ── SVG gradient for progress ring ── */
const svgEl = document.querySelector('.progress-ring');
const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
grad.setAttribute('id', 'grad');
grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '0%');
[['0%','#58a6ff'],['100%','#a855f7']].forEach(([offset, color]) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  s.setAttribute('offset', offset); s.setAttribute('stop-color', color);
  grad.appendChild(s);
});
defs.appendChild(grad); svgEl.insertBefore(defs, svgEl.firstChild);

/* ── State ── */
const state = {
  errors: [],
  attempts: 0,
  maxAttempts: 3,
  fixUnlocked: false,
  errorsFixed: 0,
  errorPattern: {},   // { errorType: count }
  debugMode: false,
};

/* ── DOM refs ── */
const editor       = document.getElementById('codeEditor');
const lineNums     = document.getElementById('lineNumbers');
const consoleOut   = document.getElementById('consoleOutput');
const btnRun       = document.getElementById('btnRun');
const btnTryRun    = document.getElementById('btnTryRun');
const btnApply     = document.getElementById('btnApply');
const btnDebugMode = document.getElementById('btnDebugMode');
const btnFocus     = document.getElementById('btnFocus');
const btnTheme     = document.getElementById('btnTheme');
const motiveBanner = document.getElementById('motiveBanner');
const motiveText   = document.getElementById('motiveText');
const errorExplain = document.getElementById('errorExplain');
const conceptTags  = document.getElementById('conceptTags');
const attemptCount = document.getElementById('attemptCount');
const debugSteps   = document.getElementById('debugSteps');
const diffBefore   = document.getElementById('diffBefore');
const diffAfter    = document.getElementById('diffAfter');
const fixConf      = document.getElementById('fixConfidence');
const statFixed    = document.getElementById('statFixed');
const statStatus   = document.getElementById('statStatus');
const sbLine       = document.getElementById('sbLine');
const sbCursor     = document.getElementById('sbCursor');
const sbErrors     = document.getElementById('sbErrors');
const readyDot     = document.getElementById('readyDot');
const readyText    = document.getElementById('readyText');
const ringFill     = document.getElementById('ringFill');
const ringLabel    = document.getElementById('ringLabel');
const qiCommon     = document.getElementById('qiCommon');
const qiLast       = document.getElementById('qiLast');
const qiSuggest    = document.getElementById('qiSuggest');
const patternBars  = document.getElementById('patternBars');
const chatBody     = document.getElementById('chatBody');
const chatInput    = document.getElementById('chatInput');
const dots         = [document.getElementById('dot1'), document.getElementById('dot2'), document.getElementById('dot3')];

/* ── Default code ── */
editor.value = `#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int main() {
    int x = 10
    int y = 20;

    int sum = add(x, y)
    printf("Sum: %d\\n", sum)

    return 0;
}
`;

/* ── Error knowledge base ── */
const errorDB = {
  'missing_semicolon': {
    label: 'Missing Semicolon',
    explain: 'The compiler expects a semicolon (;) at the end of each statement. It marks the end of an instruction. Missing it causes a syntax error.',
    concepts: ['Syntax', 'Statements', 'C Basics'],
    confidence: 98,
    steps: [
      'Reproduce the error → Compile the code.',
      'Read the error message carefully.',
      'Go to the indicated line.',
      'Add the missing semicolon (;) at the end of the statement.',
      'Recompile and verify.',
    ],
    fix: (code) => code.replace(/(\bint\s+\w+\s*=[^;{}\n]+)\n/g, '$1;\n')
                       .replace(/(add\([^)]+\))\n/g, '$1;\n')
                       .replace(/(printf\([^)]+\))\n/g, '$1;\n'),
    suggestion: 'Add semicolons at the end of each statement.',
  },
  'undeclared_variable': {
    label: 'Undeclared Variable',
    explain: 'You are using a variable that has not been declared. In C, every variable must be declared with a type before use.',
    concepts: ['Variables', 'Declarations', 'Scope'],
    confidence: 95,
    steps: [
      'Find the variable name in the error message.',
      'Check if you declared it with a type (e.g., int x;).',
      'Make sure the declaration is in the correct scope.',
      'Add the declaration before first use.',
      'Recompile and verify.',
    ],
    fix: null,
    suggestion: 'Declare all variables before using them.',
  },
  'missing_return': {
    label: 'Missing Return',
    explain: 'A function declared to return a value (like int main()) must have a return statement. Without it, the behavior is undefined.',
    concepts: ['Functions', 'Return Values', 'main()'],
    confidence: 92,
    steps: [
      'Identify the function missing a return.',
      'Add return <value>; before the closing brace.',
      'For main(), use return 0; to indicate success.',
      'Recompile and verify.',
    ],
    fix: null,
    suggestion: 'Add return 0; at the end of main().',
  },
};

/* ── Detect errors in code ── */
function detectErrors(code) {
  const errors = [];
  const lines = code.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') ||
        trimmed.endsWith('{') || trimmed.endsWith('}') || trimmed === '') return;

    const isStatement = /^(int|float|char|double|printf|scanf|return|[a-zA-Z_]\w*\s*[=(])/.test(trimmed);
    const endsWithSemi = trimmed.endsWith(';');
    const endsWithBrace = trimmed.endsWith('{') || trimmed.endsWith('}');

    if (isStatement && !endsWithSemi && !endsWithBrace && trimmed !== '') {
      errors.push({ line: i + 1, type: 'missing_semicolon', raw: line });
    }
  });

  return errors;
}

/* ── Build console error output ── */
function buildConsoleOutput(errors, filename = 'main.c') {
  if (!errors.length) return `<span class="c-green">Compilation successful.\nProgram output:\nSum: 30</span>`;
  let out = `<span class="c-white">${filename}: In function 'main':</span>\n`;
  errors.forEach(e => {
    const db = errorDB[e.type];
    out += `<span class="c-red">${filename}:${e.line}: error: expected ';' before next token</span>\n`;
    out += `    ${e.line} |  ${e.raw.trim()}\n`;
    out += `       |  ${' '.repeat(e.raw.trim().length)}^\n`;
  });
  out += `<span class="c-red">compilation terminated due to -Wfatal-errors.</span>`;
  return out;
}

/* ── Build diff view ── */
function buildDiff(errors) {
  diffBefore.innerHTML = '';
  diffAfter.innerHTML = '';
  if (!errors.length) return;

  errors.slice(0, 4).forEach(e => {
    const raw = e.raw.trim();
    const fixed = raw.endsWith(';') ? raw : raw + ';';

    const rb = document.createElement('div');
    rb.className = 'diff-line red-line';
    rb.innerHTML = `<span class="ln">${e.line}</span><span>${raw}</span><span class="diff-mark red-mark">−</span>`;
    diffBefore.appendChild(rb);

    const ra = document.createElement('div');
    ra.className = 'diff-line green-line';
    ra.innerHTML = `<span class="ln">${e.line}</span><span>${fixed}</span><span class="diff-mark green-mark">+</span>`;
    diffAfter.appendChild(ra);
  });
}

/* ── Update attempt dots ── */
function updateDots() {
  dots.forEach((d, i) => {
    d.className = 'adot';
    if (i < state.attempts) d.classList.add('fail');
  });
  attemptCount.textContent = `Attempts: ${state.attempts} / ${state.maxAttempts}`;
}

/* ── Update error pattern bars ── */
function updatePatternBars() {
  const entries = Object.entries(state.errorPattern).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  patternBars.innerHTML = entries.map(([type, count]) => {
    const db = errorDB[type];
    const label = db ? db.label : type;
    const pct = Math.round((count / max) * 100);
    return `<div class="pbar-row">
      <span class="pbar-label" title="${label}">${label}</span>
      <div class="pbar-track"><div class="pbar-fill" style="width:${pct}%"></div></div>
      <span class="pbar-count">${count}</span>
    </div>`;
  }).join('');
}

/* ── Update progress ring ── */
function updateRing(pct) {
  const circumference = 138.2;
  const offset = circumference - (pct / 100) * circumference;
  ringFill.setAttribute('stroke-dashoffset', offset.toFixed(1));
  ringLabel.textContent = pct + '%';
}

/* ── Set motivational message ── */
function setMotive(type, msg) {
  motiveBanner.className = 'motivational-banner' + (type ? ' ' + type : '');
  motiveText.innerHTML = msg;
}

/* ── Main run logic ── */
function runCode(isTryFix = false) {
  const code = editor.value;
  const errors = detectErrors(code);
  state.errors = errors;

  readyDot.classList.add('busy');
  readyText.textContent = 'Compiling...';

  setTimeout(() => {
    readyDot.classList.remove('busy');
    readyText.textContent = 'Ready';

    consoleOut.innerHTML = buildConsoleOutput(errors);

    if (!errors.length) {
      // SUCCESS
      statStatus.textContent = '✔ Success';
      statStatus.className = 'stat-val green';
      sbErrors.textContent = '✔ 0 Errors';
      sbErrors.className = 'err-badge ok';

      if (isTryFix) {
        state.errorsFixed++;
        statFixed.textContent = `✔ ${state.errorsFixed}`;
        dots[Math.min(state.attempts, 2)].className = 'adot pass';
        setMotive('success', '🎉 <strong>Excellent!</strong> You fixed it yourself! Great job — you\'re learning fast!');
        updateRing(Math.min(100, 75 + state.errorsFixed * 5));
      } else {
        setMotive('success', '✅ <strong>No errors found!</strong> Your code compiled successfully.');
      }

      errorExplain.textContent = 'No errors detected. Your code is clean!';
      conceptTags.innerHTML = '';
      debugSteps.innerHTML = '<li>No errors to debug. Well done!</li>';
      diffBefore.innerHTML = ''; diffAfter.innerHTML = '';
      fixConf.textContent = 'Confidence: —';
      btnApply.disabled = true;
      btnApply.textContent = '✔ No Fix Needed';
      qiCommon.textContent = '—'; qiLast.textContent = '—';
      qiSuggest.textContent = 'Your code is error-free!';

    } else {
      // ERRORS FOUND
      statStatus.textContent = '✖ Failed';
      statStatus.className = 'stat-val red';
      sbErrors.textContent = `⚠ ${errors.length} Error${errors.length > 1 ? 's' : ''}`;
      sbErrors.className = 'err-badge';

      const primaryType = errors[0].type;
      const db = errorDB[primaryType];

      // Track pattern
      state.errorPattern[primaryType] = (state.errorPattern[primaryType] || 0) + 1;
      updatePatternBars();

      // Error explanation
      errorExplain.textContent = db.explain;
      conceptTags.innerHTML = db.concepts.map(c => `<span class="concept-tag">${c}</span>`).join('');

      // Debug steps
      debugSteps.innerHTML = db.steps.map(s => `<li>${s}</li>`).join('');

      // Diff
      buildDiff(errors);
      fixConf.textContent = `Confidence: ${db.confidence}%`;

      // Quick insights
      qiCommon.textContent = db.label;
      qiLast.textContent = `Line ${errors[0].line}: ${db.label}`;
      qiSuggest.textContent = db.suggestion;

      if (isTryFix) {
        state.attempts++;
        updateDots();

        if (state.attempts >= state.maxAttempts) {
          state.fixUnlocked = true;
          btnApply.disabled = false;
          btnApply.textContent = '✦ Apply Fix (Unlocked)';
          setMotive('warning', `💪 <strong>Good effort!</strong> You tried ${state.maxAttempts} times. Auto-fix is now unlocked — but try to understand the fix before applying it!`);
        } else {
          const remaining = state.maxAttempts - state.attempts;
          const msgs = [
            `🔍 <strong>Not quite!</strong> Look at line ${errors[0].line} carefully. You have ${remaining} attempt${remaining > 1 ? 's' : ''} left before auto-fix unlocks.`,
            `💡 <strong>Keep trying!</strong> Hint: check if every statement ends with a semicolon. ${remaining} attempt left.`,
          ];
          setMotive('', msgs[Math.min(state.attempts - 1, msgs.length - 1)]);
        }
      } else {
        // First run
        state.attempts = 0;
        state.fixUnlocked = false;
        updateDots();
        btnApply.disabled = true;
        btnApply.textContent = '🔒 Fix Locked — Try First!';
        setMotive('', `🧠 <strong>Errors detected!</strong> Read the explanation and try to fix them yourself. Auto-fix unlocks after ${state.maxAttempts} failed attempts.`);
      }
    }
  }, 600);
}

/* ── Apply Fix ── */
btnApply.addEventListener('click', () => {
  if (btnApply.disabled) return;
  const db = errorDB[state.errors[0]?.type];
  if (!db?.fix) return;
  editor.value = db.fix(editor.value);
  updateLineNumbers();
  state.errorsFixed++;
  statFixed.textContent = `✔ ${state.errorsFixed}`;
  runCode(false);
  setMotive('success', '✦ <strong>Fix applied!</strong> Study the changes so you can fix it yourself next time.');
  updateRing(Math.min(100, 75 + state.errorsFixed * 5));
});

/* ── Run buttons ── */
btnRun.addEventListener('click', () => runCode(false));
document.getElementById('actionRun').addEventListener('click', () => runCode(false));
btnTryRun.addEventListener('click', () => runCode(true));

/* ── Debug mode toggle ── */
btnDebugMode.addEventListener('click', () => {
  state.debugMode = !state.debugMode;
  btnDebugMode.classList.toggle('active', state.debugMode);
  btnDebugMode.textContent = state.debugMode ? '🐛 Debug ON' : '🐛 Debug Mode';
});

/* ── Focus mode ── */
btnFocus.addEventListener('click', () => {
  document.body.classList.toggle('focus-mode');
  btnFocus.classList.toggle('active');
});

/* ── Theme toggle (light/dark placeholder) ── */
btnTheme.addEventListener('click', () => {
  btnTheme.textContent = btnTheme.textContent === '🌙' ? '☀️' : '🌙';
});

/* ── Line numbers ── */
function updateLineNumbers() {
  const count = editor.value.split('\n').length;
  lineNums.innerHTML = Array.from({length: count}, (_, i) => i + 1).join('<br>');
}
editor.addEventListener('input', updateLineNumbers);
editor.addEventListener('scroll', () => { lineNums.scrollTop = editor.scrollTop; });
updateLineNumbers();

/* ── Cursor position ── */
editor.addEventListener('keyup', updateCursor);
editor.addEventListener('click', updateCursor);
function updateCursor() {
  const val = editor.value.substring(0, editor.selectionStart);
  const lines = val.split('\n');
  const ln = lines.length, col = lines[lines.length - 1].length + 1;
  sbLine.textContent = `⌨ Ln ${ln}, Col ${col}`;
  sbCursor.textContent = `Cursor: Ln ${ln}, Col ${col}`;
}

/* ── Console clear ── */
document.getElementById('btnClearConsole').addEventListener('click', () => {
  consoleOut.innerHTML = '<span class="c-white">Console cleared.</span>';
});

/* ── Console tabs ── */
document.querySelectorAll('.ctab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

/* ── Sidebar navigation ── */
document.querySelectorAll('.sidebar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ── AI Chat ── */
const aiResponses = {
  why: () => {
    const db = state.errors[0] ? errorDB[state.errors[0].type] : null;
    return db ? `You're getting this error because: ${db.explain}` : 'Run your code first so I can analyze the errors!';
  },
  explain: () => 'This code defines an add() function that returns the sum of two integers, then calls it from main() and prints the result.',
  fix: () => {
    const db = state.errors[0] ? errorDB[state.errors[0].type] : null;
    return db ? `To fix this: ${db.steps.join(' → ')}` : 'No errors detected! Your code looks good.';
  },
};

const genericReplies = [
  'Great question! Try running your code first so I can give you specific help.',
  'I can help with that! Could you be more specific about which part confuses you?',
  'Check the Error Explanation panel on the right — it has a beginner-friendly description.',
  'Remember: every C statement must end with a semicolon (;).',
  'Tip: Read error messages from top to bottom — fix the first error first!',
];

function addChatMsg(text, type = 'bot') {
  const msg = document.createElement('div');
  msg.className = `ai-msg ${type}`;
  msg.innerHTML = text;
  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
}

document.querySelectorAll('.ai-quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.q;
    addChatMsg(btn.textContent, 'user');
    setTimeout(() => addChatMsg(aiResponses[q]?.() || genericReplies[0]), 400);
  });
});

document.getElementById('btnSend').addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg) return;
  addChatMsg(msg, 'user');
  chatInput.value = '';
  const lower = msg.toLowerCase();
  let reply;
  if (lower.includes('error') || lower.includes('why')) reply = aiResponses.why();
  else if (lower.includes('fix') || lower.includes('how')) reply = aiResponses.fix();
  else if (lower.includes('explain') || lower.includes('what')) reply = aiResponses.explain();
  else reply = genericReplies[Math.floor(Math.random() * genericReplies.length)];
  setTimeout(() => addChatMsg(reply), 450);
}

document.getElementById('actionAsk').addEventListener('click', () => {
  chatInput.focus();
});

/* ── Initial state ── */
runCode(false);
