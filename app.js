const API_URL = 'http://127.0.0.1:5000/api';

// DOM Elements
const navEditorBtn = document.getElementById('nav-editor');
const navDashboardBtn = document.getElementById('nav-dashboard');
const viewEditor = document.getElementById('view-editor');
const viewDashboard = document.getElementById('view-dashboard');

const runBtn = document.getElementById('run-btn');
const codeEditor = document.getElementById('code-editor');
const consoleOutput = document.getElementById('console-output');
const tutorChat = document.getElementById('tutor-chat');
const tutorActions = document.getElementById('tutor-actions');
const nextHintBtn = document.getElementById('next-hint-btn');

// State
let currentHints = [];
let currentHintIndex = 0;

// Navigation
navEditorBtn.addEventListener('click', () => {
    navEditorBtn.classList.add('active');
    navDashboardBtn.classList.remove('active');
    viewEditor.style.display = 'flex';
    viewDashboard.style.display = 'none';
});

navDashboardBtn.addEventListener('click', () => {
    navDashboardBtn.classList.add('active');
    navEditorBtn.classList.remove('active');
    viewEditor.style.display = 'none';
    viewDashboard.style.display = 'flex';
    fetchDashboardStats();
});

// Run Code
runBtn.addEventListener('click', async () => {
    const code = codeEditor.value;
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
    consoleOutput.textContent = 'Compiling and running...';
    consoleOutput.classList.remove('error-text');
    
    // Clear previous chat except intro
    tutorChat.innerHTML = '<div class="message tutor-msg">Checking your code...</div>';
    tutorActions.style.display = 'none';
    currentHints = [];
    currentHintIndex = 0;

    try {
        const response = await fetch(`${API_URL}/compile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (data.status === 'success') {
            consoleOutput.textContent = data.output || 'Program finished successfully with no output.';
            addTutorMessage("Great job! Your code compiled and ran successfully.", "success");
        } else {
            // Handle Error
            consoleOutput.textContent = data.raw_error;
            consoleOutput.classList.add('error-text');
            
            if (data.analysis && data.analysis.matched) {
                // Rule matched!
                addTutorMessage(`Oops! I found an issue. ${data.analysis.simplification}`, "error");
                currentHints = data.analysis.hints;
                
                if (currentHints.length > 0) {
                    tutorActions.style.display = 'flex';
                }
            } else {
                addTutorMessage("Oops! There is an error, but I'm not exactly sure what it means. Check the raw compiler output below.", "error");
            }
        }
    } catch (error) {
        consoleOutput.textContent = 'Failed to connect to the backend server.';
        consoleOutput.classList.add('error-text');
        addTutorMessage("Sorry, I can't connect to the compiler right now. Is the server running?", "error");
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = '▶ Run Code';
    }
});

// Hint System
nextHintBtn.addEventListener('click', () => {
    if (currentHintIndex < currentHints.length) {
        addTutorMessage(`Hint ${currentHintIndex + 1}: ${currentHints[currentHintIndex]}`);
        currentHintIndex++;
        
        if (currentHintIndex >= currentHints.length) {
            tutorActions.style.display = 'none';
            addTutorMessage("That's all the hints I have for this error! Give it a try.");
        }
    }
});

function addTutorMessage(text, type = "normal") {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type === "error" ? "error-msg" : "tutor-msg"}`;
    msgDiv.textContent = text;
    tutorChat.appendChild(msgDiv);
    tutorChat.scrollTop = tutorChat.scrollHeight;
}

// Dashboard
async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/dashboard`);
        const data = await response.json();
        
        document.getElementById('stat-total').textContent = data.total_attempts;
        document.getElementById('stat-success').textContent = data.successful_attempts;
        document.getElementById('stat-errors').textContent = data.error_attempts;
        
        const topicsList = document.getElementById('weak-concepts-list');
        topicsList.innerHTML = '';
        
        if (data.weak_concepts && data.weak_concepts.length > 0) {
            data.weak_concepts.forEach(concept => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${concept.concept}</span> <span>${concept.count} errors</span>`;
                topicsList.appendChild(li);
            });
        } else {
            topicsList.innerHTML = '<li>No error data yet. Keep coding!</li>';
        }
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
    }
}
