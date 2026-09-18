// Google Apps Script API endpoints
const FETCH_API_URL = "YOUR_FETCH_DATA_SCRIPT_WEB_APP_URL";
const SUBMIT_API_URL = "YOUR_SUBMIT_RESPONSE_SCRIPT_WEB_APP_URL";

let questionsData = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let violationsCount = 0;
let isExamActive = false;
let examStartTime = null;

// Fetch Exam Metadata & Questions
window.addEventListener('DOMContentLoaded', async () => {
    try {
        let response = await fetch(FETCH_API_URL);
        let data = await response.json();

        if (data.control.linkStatus.toLowerCase() === "closed") {
            document.getElementById('closed-modal').classList.remove('hidden');
            return;
        }

        document.getElementById('test-title-header').innerText = data.control.testName;
        questionsData = data.questions;
        examStartTime = new Date(data.control.startTime).getTime();

        startCountdownTimer();
    } catch (err) {
        alert("Failed to load exam data. Please check network connection.");
    }
});

// Countdown Timer Sync IST
function startCountdownTimer() {
    let timerInterval = setInterval(() => {
        let now = new Date().getTime();
        let distance = examStartTime - now;

        if (distance <= 0) {
            clearInterval(timerInterval);
            document.getElementById('countdown-timer').innerText = "Exam Started!";
            document.getElementById('startExamBtn').disabled = false;
        } else {
            let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            let seconds = Math.floor((distance % (1000 * 60)) / 1000);
            document.getElementById('countdown-timer').innerText = `${hours}h ${minutes}m ${seconds}s`;
        }
    }, 1000);
}

// Start Exam & Enable Fullscreen
document.getElementById('startExamBtn').addEventListener('click', () => {
    if(!document.getElementById('regForm').checkValidity()){
        alert("Please fill all details correctly!");
        return;
    }
    
    // Request Fullscreen
    let elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    }

    document.getElementById('registration-card').classList.add('hidden');
    document.getElementById('exam-card').classList.remove('hidden');
    isExamActive = true;
    
    setupSurveillance();
    renderQuestion();
});

// Render Questions
function renderQuestion() {
    let q = questionsData[currentQuestionIndex];
    document.getElementById('question-count-badge').innerText = `Question ${currentQuestionIndex + 1}/${questionsData.length}`;
    document.getElementById('question-text').innerText = `${q.srNo}. ${q.question}`;

    let optionsDiv = document.getElementById('options-container');
    optionsDiv.innerHTML = '';

    let optionKeys = ['A', 'B', 'C', 'D'];
    q.options.forEach((optText, index) => {
        let btn = document.createElement('button');
        btn.className = `option-btn ${userAnswers[q.srNo] === optionKeys[index] ? 'selected' : ''}`;
        btn.innerText = `${optionKeys[index]}. ${optText}`;
        btn.onclick = () => {
            userAnswers[q.srNo] = optionKeys[index];
            renderQuestion();
        };
        optionsDiv.appendChild(btn);
    });
}

function navigateQuestion(step) {
    if (currentQuestionIndex + step >= 0 && currentQuestionIndex + step < questionsData.length) {
        currentQuestionIndex += step;
        renderQuestion();
    }
}

// AI Surveillance Logic
function setupSurveillance() {
    // Disable PrintScreen / Keys
    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen') {
            triggerViolation("Screenshot Detected");
        }
    });

    // Detect Tab Switching
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isExamActive) {
            triggerViolation("Tab Switching Detected");
        }
    });

    // Detect Fullscreen Exit
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && isExamActive) {
            triggerViolation("Fullscreen Exit Detected");
        }
    });
}

function triggerViolation(reason) {
    violationsCount++;
    document.getElementById('violation-badge').innerText = `Violations: ${violationsCount}/3`;

    if (violationsCount >= 3) {
        applyPunishment();
    } else {
        alert(`Warning ${violationsCount}/3: ${reason}! Don't switch tab or exit fullscreen.`);
    }
}

function applyPunishment() {
    document.getElementById('punishment-overlay').classList.remove('hidden');
    let penaltyTime = 60;
    let timerElem = document.getElementById('penalty-timer');

    let penaltyInterval = setInterval(() => {
        penaltyTime--;
        timerElem.innerText = penaltyTime;
        if (penaltyTime <= 0) {
            clearInterval(penaltyInterval);
            document.getElementById('punishment-overlay').classList.add('hidden');
            violationsCount = 0; // Reset after punishment
            
            // Re-request fullscreen
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            }
        }
    }, 1000);
}

// Submit Response to Apps Script
async function confirmSubmit() {
    if (confirm("Are you sure you want to submit the exam?")) {
        isExamActive = false;

        if (document.exitFullscreen) {
            document.exitFullscreen();
        }

        let payload = {
            fullName: document.getElementById('fullName').value,
            collegeName: document.getElementById('collegeName').value,
            yearOfStudy: document.getElementById('yearOfStudy').value,
            email: document.getElementById('email').value,
            whatsapp: document.getElementById('whatsapp').value,
            answers: userAnswers,
            violations: violationsCount
        };

        let response = await fetch(SUBMIT_API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        let result = await response.json();

        // Render Scorecard
        document.getElementById('exam-card').classList.add('hidden');
        document.getElementById('score-card').classList.remove('hidden');

        document.getElementById('res-marks').innerText = `${result.score}/${result.totalQuestions}`;
        document.getElementById('res-percentage').innerText = `${result.percentage}%`;
        document.getElementById('res-violations').innerText = violationsCount;

        if (parseFloat(result.percentage) >= 50) {
            document.getElementById('certificate-section').classList.remove('hidden');
        }
    }
}
