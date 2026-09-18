// Replace with your Google Apps Script Deployed Web App URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyj_WgbdmxrfVpmaj9QYmSGvbu3aJvDDEMPNWqbdzdV7IPM6pHgdNgeTM6MDaxtalvK/exec";

let controlData = {};
let questions = [];
let currentQIndex = 0;
let userAnswers = {};
let violationsCount = 0;
let isExamActive = false;
let isPaused = false;

document.addEventListener("DOMContentLoaded", () => {
  fetchControlSettings();
});

// 1. Fetch Control Panel Settings
async function fetchControlSettings() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getControl`);
    controlData = await response.json();

    document.getElementById("test-name-display").innerText = controlData.testName;

    if (controlData.linkStatus !== "Open") {
      showAlert("Registration is Closed by Administrator.", "danger");
      return;
    }

    startCountdownTimer(controlData.startTime, controlData.endTime);
  } catch (err) {
    showAlert("Failed to load exam details. Refresh again.", "danger");
  }
}

// 2. IST Countdown Clock
function startCountdownTimer(startStr, endStr) {
  const timerElem = document.getElementById("countdown-clock");
  const startBtn = document.getElementById("start-exam-btn");

  const interval = setInterval(() => {
    const now = new Date();
    const startTime = new Date(startStr);
    const endTime = new Date(endStr);

    if (now >= endTime) {
      clearInterval(interval);
      timerElem.innerText = "Exam Expired";
      showAlert("Exam time window has expired.", "danger");
      return;
    }

    const diff = startTime - now;

    if (diff <= 0) {
      clearInterval(interval);
      timerElem.innerText = "Exam is Live!";
      startBtn.disabled = false;
      startBtn.onclick = startExamProcess;
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      timerElem.innerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
  }, 1000);
}

function pad(n) { return n < 10 ? '0' + n : n; }

// 3. Start Exam & Fetch Questions
async function startExamProcess() {
  if (!validateForm()) return;

  // Request Fullscreen
  enableFullScreen();

  // Load Questions
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getQuestions`);
    questions = await res.json();

    if (!questions.length) {
      alert("No questions found.");
      return;
    }

    document.getElementById("registration-card").classList.add("hidden");
    document.getElementById("exam-card").classList.remove("hidden");
    document.getElementById("total-q-num").innerText = questions.length;

    isExamActive = true;
    setupSurveillance();
    renderQuestion();

  } catch (err) {
    alert("Error fetching questions.");
  }
}

function renderQuestion() {
  const q = questions[currentQIndex];
  document.getElementById("current-q-num").innerText = currentQIndex + 1;
  document.getElementById("question-text").innerText = `${q.srNo}. ${q.question}`;

  const container = document.getElementById("options-container");
  container.innerHTML = "";

  const options = ['A', 'B', 'C', 'D'];
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    if (userAnswers[currentQIndex] === opt) btn.classList.add("selected");
    btn.innerText = `${opt}) ${q['option' + opt]}`;
    btn.onclick = () => {
      userAnswers[currentQIndex] = opt;
      renderQuestion();
    };
    container.appendChild(btn);
  });

  document.getElementById("prev-btn").disabled = currentQIndex === 0;
  if (currentQIndex === questions.length - 1) {
    document.getElementById("next-btn").classList.add("hidden");
    document.getElementById("submit-btn").classList.remove("hidden");
  } else {
    document.getElementById("next-btn").classList.remove("hidden");
    document.getElementById("submit-btn").classList.add("hidden");
  }
}

function nextQuestion() { if (currentQIndex < questions.length - 1) { currentQIndex++; renderQuestion(); } }
function prevQuestion() { if (currentQIndex > 0) { currentQIndex--; renderQuestion(); } }

// 4. Advanced AI Surveillance System
function setupSurveillance() {
  // Prevent Right Click & Screenshot Key Combos
  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("keydown", e => {
    if (e.key === "PrintScreen" || (e.ctrlKey && e.key === "p") || (e.metaKey && e.shiftKey)) {
      e.preventDefault();
      triggerViolation("Screenshot or Print action blocked!");
    }
  });

  // Track Tab Switch / Window Blur
  window.addEventListener("blur", () => {
    if (isExamActive) triggerViolation("Tab switch or Window exit detected!");
  });

  // Fullscreen exit tracking
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && isExamActive) {
      triggerViolation("Exited Fullscreen mode!");
    }
  });
}

function triggerViolation(msg) {
  if (isPaused) return;
  violationsCount++;
  const modal = document.getElementById("warning-modal");
  document.getElementById("warning-msg").innerText = `${msg} Violation count: ${violationsCount}/3`;
  modal.classList.remove("hidden");

  if (violationsCount >= 3) {
    pauseExamForPenalty();
  }
}

function pauseExamForPenalty() {
  isPaused = true;
  let lockTime = 60;
  const pElem = document.getElementById("pause-timer");
  const countdown = document.getElementById("lock-countdown");
  pElem.classList.remove("hidden");

  const timer = setInterval(() => {
    lockTime--;
    countdown.innerText = lockTime;
    if (lockTime <= 0) {
      clearInterval(timer);
      pElem.classList.add("hidden");
      dismissWarning();
      isPaused = false;
      enableFullScreen();
    }
  }, 1000);
}

function dismissWarning() {
  if (!isPaused) {
    document.getElementById("warning-modal").classList.add("hidden");
    enableFullScreen();
  }
}

function enableFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

// 5. Exam Submission
async function confirmSubmit() {
  if (!confirm("Are you sure you want to submit the exam?")) return;

  isExamActive = false;
  if (document.fullscreenElement) document.exitFullscreen();

  // Score Calculation
  let marks = 0;
  questions.forEach((q, idx) => {
    if (userAnswers[idx] === q.answer) marks++;
  });

  const percentage = ((marks / questions.length) * 100).toFixed(2);

  const payload = {
    fullName: document.getElementById("fullName").value,
    collegeName: document.getElementById("collegeName").value,
    yearOfStudy: document.getElementById("yearOfStudy").value,
    email: document.getElementById("email").value,
    whatsapp: document.getElementById("whatsapp").value,
    marks: marks,
    totalQuestions: questions.length,
    percentage: percentage,
    violations: violationsCount
  };

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.status === "ALREADY_SUBMITTED") {
      alert("You have already submitted this exam!");
      location.reload();
      return;
    }

    // Display Result & Scorecard
    document.getElementById("exam-card").classList.add("hidden");
    document.getElementById("result-card").classList.remove("hidden");

    document.getElementById("final-marks").innerText = `${marks} / ${questions.length}`;
    document.getElementById("final-percentage").innerText = `${percentage}%`;
    document.getElementById("final-violations").innerText = violationsCount;

    if (parseFloat(percentage) >= 50) {
      document.getElementById("certificate-box").classList.remove("hidden");
    }

  } catch (err) {
    alert("Error submitting exam. Please check internet connection.");
  }
}

function validateForm() {
  const fields = ["fullName", "collegeName", "yearOfStudy", "email", "whatsapp"];
  for (let f of fields) {
    if (!document.getElementById(f).value) {
      alert("Please fill all candidate registration details.");
      return false;
    }
  }
  return true;
}

function showAlert(msg, type) {
  const alert = document.getElementById("status-alert");
  alert.innerText = msg;
  alert.className = `alert alert-${type}`;
  alert.classList.remove("hidden");
}
