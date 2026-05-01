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
  errorDB: {}, // Loaded from server
  errors: [], // Now populated from the backend
  totalRuns: 0,
  attempts: 0,
  maxAttempts: 3,
  fixUnlocked: false,
  errorsFixed: 0,
  errorPattern: {},   // { errorType: count }
  history: [],
  streak: 0,
  debugMode: false,
};

/* ── DOM refs ── */
const editor       = document.getElementById('codeEditor');
const lineNums     = document.getElementById('lineNumbers');
const consoleOut   = document.getElementById('consoleOutput');
const btnRun       = document.getElementById('btnRun');
const btnLogic     = document.getElementById('btnLogicBuilder');
const logicModal   = document.getElementById('logicModal');
const btnTryRun    = document.getElementById('btnTryRun');
const btnApply     = document.getElementById('btnApply');
const btnDebugMode = document.getElementById('btnDebugMode');
const btnLbGenerate = document.getElementById('btnLbGenerate');
const lbProblem    = document.getElementById('lbProblem');
const lbStepsArea  = document.getElementById('lbStepsArea');
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
const hintText     = document.getElementById('hintText');
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
const perfTotal    = document.getElementById('perfTotal');
const perfFixed    = document.getElementById('perfFixed');
const perfScore    = document.getElementById('perfScore');
const weakTopics   = document.getElementById('weakTopics');
const personalFeedback = document.getElementById('personalFeedback');
const perfStreak   = document.getElementById('perfStreak');
const chatBody     = document.getElementById('chatBody');
const chatInput    = document.getElementById('chatInput');
const dots         = [document.getElementById('dot1'), document.getElementById('dot2'), document.getElementById('dot3')];

/* ── Logic Builder Refs ── */
const closeLogic   = document.getElementById('closeLogicModal');
btnLogic.addEventListener('click', () => logicModal.classList.add('active'));
closeLogic.addEventListener('click', () => logicModal.classList.remove('active'));
window.addEventListener('click', (e) => { if(e.target === logicModal) logicModal.classList.remove('active'); });


/* ── Default C Template ── */
editor.value = `#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int main() {
    int x = 10
    int y = 20;

    int sum = add(x, y)
    printf("Sum: %d\\n", sum);

    return 0;
}
`;

/* ── Build console output ── */
function buildConsoleOutput(errors, filename = 'main.c') {
  let out = '';
  errors.forEach(e => {
    out += `<span class="c-red">${filename}:${e.line}:${e.col}: error: ${e.message}</span>\n`;
    if (e.raw) {
      out += `    ${e.line} |  ${e.raw.trim()}\n`;
      out += `       |  <span class="c-red">${' '.repeat(e.col-1)}^</span>\n`;
    }
  });
  return out;
}

/* ── Build diff view ── */
function buildDiff(error) {
  diffBefore.innerHTML = '';
  diffAfter.innerHTML = '';
  if (!error) return;

  const raw = error.raw.trim();
  const rb = document.createElement('div');
  rb.className = 'diff-line red-line';
  rb.innerHTML = `<span class="ln">${error.line}</span><span>${raw}</span><span class="diff-mark red-mark">−</span>`;
  diffBefore.appendChild(rb);

  if (error.type === 'missing_semicolon') {
    const fixed = raw + ';';

    const ra = document.createElement('div');
    ra.className = 'diff-line green-line';
    ra.innerHTML = `<span class="ln">${error.line}</span><span>${fixed}</span><span class="diff-mark green-mark">+</span>`;
    diffAfter.appendChild(ra);
  } else {
    diffAfter.innerHTML = '<div class="diff-header" style="padding:10px">Manual fix required</div>';
  }
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
  const entries = Object.entries(state.errorPattern);
  const max = Math.max(...entries.map(e => e[1]), 1);
  patternBars.innerHTML = entries.map(([label, count]) => {
    const pct = Math.round((count / max) * 100);
    return `<div class="pbar-row">
      <span class="pbar-label" title="${label}">${label}</span>
      <div class="pbar-track"><div class="pbar-fill" style="width:${pct}%"></div></div>
      <span class="pbar-count">${count}</span>
    </div>`;
  }).join('');
}

/* ── Update Tracker ── */
function updatePerformanceUI() {
  perfTotal.textContent = state.totalRuns;
  perfFixed.textContent = state.errorsFixed;
  perfStreak.textContent = state.streak;
  const score = (state.errorsFixed * 50) - (state.attempts * 5);
  const finalScore = Math.max(0, score);
  perfScore.textContent = finalScore + ' pts';
  document.getElementById('statScore').textContent = finalScore + ' pts';

  // Weak Topics Logic
  const topics = Object.entries(state.errorPattern)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);
  
  weakTopics.innerHTML = topics.length 
    ? topics.map(([topic]) => `<div class="concept-tag" style="background:rgba(248,81,73,0.1); border-color:rgba(248,81,73,0.3); color:var(--red)">${topic}</div>`).join('')
    : '<div class="rcard-text">Keep coding to analyze weak areas!</div>';

  if (topics.length > 0) {
    personalFeedback.textContent = `You've encountered "${topics[0][0]}" several times. Consider reviewing the concepts in your textbooks or asking the AI for a deep dive!`;
  }
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
async function runCode(isTryFix = false) {
  const code = editor.value;
  state.totalRuns++;
  readyDot.classList.add('busy');
  readyText.textContent = 'Compiling...';

  try {
    const response = await fetch('http://localhost:5000/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await response.json();
    const errors = data.errors || [];
    state.errors = errors;

    updatePerformanceUI();

    readyDot.classList.remove('busy');
    readyText.textContent = 'Ready';

    // Display actual stdout from compiler or runtime
    consoleOut.innerHTML = data.success ? 
      `<span class="c-green">Execution Successful:</span>\n${data.stdout}` : 
      (data.runtime_error ? `<span class="c-red">⚠️ Runtime Error:</span>\n${data.runtime_error}\n` + buildConsoleOutput(errors) : buildConsoleOutput(errors));

    if (!errors.length) {
      // SUCCESS
      statStatus.textContent = '✔ Success';
      statStatus.style.color = 'var(--green)';
      statStatus.className = 'stat-val green';
      sbErrors.textContent = '✔ 0 Errors';
      sbErrors.className = 'err-badge ok';

      if (isTryFix) {
        state.errorsFixed++;
        state.streak++;
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
      state.streak = 0;

      const errorData = errors[0];
      const db = errorData.db;

      // Setup hint system
      resetHints(db);

      // Track pattern by label
      const label = db ? db.label : "General Error";
      state.errorPattern[label] = (state.errorPattern[label] || 0) + 1;
      updatePatternBars();

      // Error explanation from Backend DB
      errorExplain.textContent = db ? db.explain : errorData.message;
      conceptTags.innerHTML = db ? db.concepts.map(c => `<span class="concept-tag">${c}</span>`).join('') : '';

      // Step-by-step logic from Backend
      debugSteps.innerHTML = db ? db.steps.map(s => `<li>${s}</li>`).join('') : '<li>Check the line for syntax issues.</li>';

      // Diff
      buildDiff(errorData);
      fixConf.textContent = db ? `Confidence: ${db.confidence}%` : 'Confidence: High';

      // Quick insights
      qiCommon.textContent = label;
      qiLast.textContent = `Line ${errorData.line}: ${label}`;
      qiSuggest.textContent = db ? db.suggestion : "Check for typos.";

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
  } catch (err) {
    consoleOut.innerHTML = `<span class="c-red">Connection Error: Ensure the Backend server is running.</span>`;
    readyText.textContent = 'Error';
  }
}

/* ── Interactive Hint Logic ── */
function resetHints(db) {
  hintText.innerHTML = '<span style="color:var(--text-dim)">Stuck? Click Hint 1 to start.</span>';
  document.querySelectorAll('.hint-btn').forEach((btn, i) => {
    btn.disabled = i > 0; // Only enable Hint 1
    btn.classList.remove('active');
    
    btn.onclick = () => {
      if (!db || !db.hints[i]) return;
      hintText.innerHTML = `<strong>Hint ${i+1}:</strong> ${db.hints[i]}`;
      btn.classList.add('active');
      
      // Unlock next hint
      const next = document.getElementById(`hintBtn${i+2}`);
      if (next) next.disabled = false;
    };
  });
}

/* ── Logic Builder Generation ── */
btnLbGenerate.addEventListener('click', () => {
  const input = lbProblem.value.toLowerCase();
  if (!input) return;

  lbStepsArea.innerHTML = '<div class="c-white" style="padding:20px">✨ AI is breaking down your problem into logical steps...</div>';
  
  // Simplified NLP Logic Breakdown
  let steps = [
    "Step 1: Include Standard I/O library (#include <stdio.h>)",
    "Step 2: Start your main function: int main() { ... }"
  ];

  if (input.includes("sum") || input.includes("add")) {
    steps.push("Step 3: 📋 Declare variables to hold your numbers (e.g., int num1, num2, sum;)");
    steps.push("Step 4: 📥 Get input from the user using scanf() or assign values directly.");
    steps.push("Step 5: ➕ Perform the addition logic: sum = num1 + num2;");
    steps.push("Step 6: 📤 Display the result using printf() with the %d format specifier.");
  } else if (input.includes("loop") || input.includes("print 1 to")) {
    steps.push("Step 3: 🔢 Declare a counter variable (e.g., int i;)");
    steps.push("Step 4: 🔄 Set up a loop (like for or while) with a start, condition, and increment.");
    steps.push("Step 5: 📝 Inside the loop body, write the printf() statement to print the current number.");
  } else if (input.includes("even") || input.includes("odd")) {
    steps.push("Step 3: 📥 Get a number from the user.");
    steps.push("Step 4: ⚖️ Use the modulo operator (%) to check the remainder when divided by 2.");
    steps.push("Step 5: 🛣️ Use an if-else statement: if(n % 2 == 0) for even, else for odd.");
    steps.push("Step 6: 📤 Print the appropriate message.");
  } else if (input.includes("average") || input.includes("mean")) {
    steps.push("Step 3: 🔢 Declare float variables for decimal precision (e.g., float a, b, avg;)");
    steps.push("Step 4: 📥 Input the numbers.");
    steps.push("Step 5: ➕ Sum the numbers and divide by the count (e.g., avg = (a + b) / 2.0;)");
    steps.push("Step 6: 📤 Output the average using %.2f to show two decimal places.");
  } else {
    steps.push("Step 3: Identify the main action (Calculation or Input).");
    steps.push("Step 4: Use conditional statements (if/else) if decisions are needed.");
    steps.push("Step 5: Use printf() to output your final result.");
  }
  steps.push("Step 6: Return 0 and close your braces.");

  setTimeout(() => {
    lbStepsArea.innerHTML = steps.map((step, i) => `
      <div class="lb-step">
        <div class="lb-step-text">${step}</div>
        <div class="lb-step-check">○</div>
      </div>
    `).join('');
    
    // Make steps interactive
    document.querySelectorAll('.lb-step').forEach(s => s.onclick = () => {
      s.classList.toggle('completed');
      s.querySelector('.lb-step-check').textContent = s.classList.contains('completed') ? '●' : '○';
    });
  }, 600);
});

/* ── Apply Fix ── */
btnApply.addEventListener('click', () => {
  if (btnApply.disabled) return;
  // Logic to apply the suggested fix based on type
  const err = state.errors[0];
  if (err && err.type === 'missing_semicolon') {
     const lines = editor.value.split('\n');
     lines[err.line-1] = lines[err.line-1].trimEnd() + ';';
     editor.value = lines.join('\n');
     updateLineNumbers();
     state.errorsFixed++;
     runCode(false);
     setMotive('success', '✦ <strong>Fix applied!</strong> Study the changes so you can fix it yourself next time.');
  }
});

/* ── Run buttons ── */
btnRun.addEventListener('click', () => runCode(false));
document.getElementById('actionRun').addEventListener('click', () => runCode(false));
document.getElementById('actionDebug').addEventListener('click', () => btnDebugMode.click());
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
    
    const target = btn.dataset.panel;
    const panelId = 'panel' + target.charAt(0).toUpperCase() + target.slice(1);
    const targetPanel = document.getElementById(panelId);

    if (targetPanel) {
    document.querySelectorAll('.panel-view').forEach(panel => {
      panel.classList.remove('active');
    });
      targetPanel.classList.add('active');
    } else {
      console.warn(`Panel ${panelId} not found in HTML.`);
    }
  });
});

/* ── AI Chat ── */
const aiResponses = {
  why: () => {
    const db = state.errors[0]?.db;
    return db ? `You're getting this error because: ${db.explain}` : 'Run your code first so I can analyze the errors!';
  },
  explain: () => 'This code defines an add() function that returns the sum of two integers, then calls it from main() and prints the result.',
  fix: () => {
    const db = state.errors[0]?.db;
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

document.getElementById('btnCloseChat').addEventListener('click', () => {
  document.querySelector('.ai-chat-box').style.display = 'none';
});

document.getElementById('actionAsk').addEventListener('click', () => {
  document.querySelector('.ai-chat-box').style.display = 'flex';
  chatInput.focus();
});

/* ── Initial state ── */
// Fetch initial ErrorDB from server to sync AI Chat
fetch('http://localhost:5000/errordb')
  .then(res => res.json())
  .then(data => { state.errorDB = data; })
  .catch(() => console.log("Offline mode: Using local logic."));

updateLineNumbers();
