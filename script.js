 // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries
import { getFirestore, collection, addDoc,getDocs, query, where,updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyAklY3oyTKiSY7S3UmIu1YYFlrq-v5hMc0",
    authDomain: "college-website-26532.firebaseapp.com",
    projectId: "college-website-26532",
    storageBucket: "college-website-26532.firebasestorage.app",
    messagingSenderId: "6582609710",
    appId: "1:6582609710:web:5542ac4c21bf3090c9fcbf"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
const STORAGE_KEYS = {
  sessions: "gec_dahod_sessions_v2",
  attendance: "gec_dahod_attendance_v2",
  currentStudent: "gec_dahod_current_student_v2",
  currentTeacher: "gec_dahod_current_teacher_v2"
};

const TEACHER_PASSWORD = "gecdahod123";
const SESSION_DURATION = 60 * 1000;
const MAX_WRONG_ATTEMPTS = 5;

let sessions = load(STORAGE_KEYS.sessions, []);
let attendance = load(STORAGE_KEYS.attendance, []);
let currentStudent = load(STORAGE_KEYS.currentStudent, null);
let currentTeacher = load(STORAGE_KEYS.currentTeacher, null);
let selectedSessionId = null;
let activeSessionId = null;
let countdownInterval = null;
let studentTimerInterval = null;
let wrongAttempts = {};

const $ = (id) => document.getElementById(id);
$("createSessionBtn").addEventListener("click", async () => {
    try {
        const subject = $("subject").value.trim();
        const className = $("className").value.trim();

        if (!subject || !className) {
            alert("Please enter Subject and Class / Division.");
            return;
        }

        const sessionData = {
            subject: subject,
            className: className,
            createdAt: new Date().toISOString(),
            active: true
        };

        const docRef = await addDoc(
            collection(db, "sessions"),
            sessionData
        );

        console.log("Session saved:", docRef.id);

        alert("Attendance session created!");

    } catch (error) {
        console.error("Firestore error:", error);
        alert("Could not save session to Firestore.");
    }
});

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[ch]);
}

function showToast(message, type = "normal") {
  const toast = $("toast");
  toast.textContent = message;
  toast.style.background = type === "error" ? "#991b1b" : type === "success" ? "#166534" : "#0f172a";
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function switchLoginRole(role) {
  const student = role === "student";

  $("studentTab").classList.toggle("active", student);
  $("teacherTab").classList.toggle("active", !student);
  $("studentLoginForm").classList.toggle("hidden", !student);
  $("teacherLoginForm").classList.toggle("hidden", student);
}

function showOnly(pageId) {
  ["loginPage", "studentDashboard", "teacherDashboard"].forEach(id => {
    $(id).classList.add("hidden");
  });
  $(pageId).classList.remove("hidden");
}

function normalizeEnrollment(value) {
  return value.trim().toUpperCase();
}

function currentStudentRecords() {
  if (!currentStudent) return [];
  return attendance.filter(
    record => record.enrollment === currentStudent.enrollment
  );
}

function teacherOwns(session) {
  return currentTeacher && session.teacherId === currentTeacher.id;
}

function createId() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return "GEC-" + Date.now().toString(36).toUpperCase() + "-" + random;
}

function createCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function startTeacherCountdown(session) {
  clearInterval(countdownInterval);
  activeSessionId = session.id;

  function update() {
    const remaining = Math.max(0, session.expiresAt - Date.now());
    const seconds = Math.ceil(remaining / 1000);

    $("teacherCountdown").textContent =
      seconds > 0 ? `${seconds}s remaining` : "EXPIRED";

    if (seconds <= 0) {
      $("teacherCountdown").style.color = "#dc2626";
      clearInterval(countdownInterval);
    } else {
      $("teacherCountdown").style.color = "#162238";
    }
  }

  update();
  countdownInterval = setInterval(update, 250);
}

function startStudentTimer() {
  clearInterval(studentTimerInterval);

  function update() {
    const id = $("studentSessionId").value.trim();
    const timer = $("studentTimer");

    if (!id) {
      timer.textContent = "Enter a session ID";
      timer.className = "timer neutral";
      return;
    }

    const session = sessions.find(s => s.id === id);

    if (!session) {
      timer.textContent = "Session not found";
      timer.className = "timer danger";
      return;
    }

    const remaining = session.expiresAt - Date.now();

    if (remaining <= 0) {
      timer.textContent = "SESSION EXPIRED";
      timer.className = "timer danger";
      return;
    }

    timer.textContent = `${Math.ceil(remaining / 1000)} seconds remaining`;
    timer.className = "timer neutral";
  }

  update();
  studentTimerInterval = setInterval(update, 250);
}

function renderStudentHistory() {
  const box = $("studentHistory");
  const records = currentStudentRecords().slice().sort((a, b) => b.timestamp - a.timestamp);

  if (!records.length) {
    box.innerHTML = `<div class="empty">No attendance records yet.</div>`;
    return;
  }

  box.innerHTML = records.map(record => `
    <div class="history-item">
      <div>
        <h4>${escapeHtml(record.subject)}</h4>
        <p>${escapeHtml(record.className)}</p>
        <small>${escapeHtml(record.sessionId)}</small>
      </div>
      <div style="text-align:right">
        <span class="present-badge">PRESENT</span>
        <p>${escapeHtml(new Date(record.timestamp).toLocaleString())}</p>
      </div>
    </div>
  `).join("");
}

function renderTeacherSessions() {
  const box = $("teacherSessionList");
  const own = sessions
    .filter(session => teacherOwns(session))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!own.length) {
    box.innerHTML = `<div class="empty">No sessions created yet.</div>`;
    return;
  }

  box.innerHTML = own.map(session => `
    <div class="session-item" data-session="${escapeHtml(session.id)}">
      <strong>${escapeHtml(session.subject)}</strong>
      <small>${escapeHtml(session.className)}</small>
      <small>${escapeHtml(session.id)}</small>
      <small>Created: ${escapeHtml(new Date(session.createdAt).toLocaleString())}</small>
    </div>
  `).join("");

  box.querySelectorAll(".session-item").forEach(item => {
    item.addEventListener("click", () => {
      openTeacherSession(item.dataset.session);
    });
  });
}

function openTeacherSession(sessionId) {
  const session = sessions.find(s => s.id === sessionId);

  if (!session || !teacherOwns(session)) {
    showToast("You cannot open this session.", "error");
    return;
  }

  selectedSessionId = session.id;
  $("teacherAttendanceCard").classList.remove("hidden");
  $("teacherAttendanceTitle").textContent =
    `${session.subject} — ${session.className}`;

  renderTeacherAttendance();
  $("teacherAttendanceCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTeacherAttendance() {
  const body = $("attendanceTableBody");

  if (!selectedSessionId) return;

  const session = sessions.find(s => s.id === selectedSessionId);

  if (!session || !teacherOwns(session)) {
    body.innerHTML = "";
    return;
  }

  const records = attendance
    .filter(record => record.sessionId === session.id)
    .sort((a, b) => a.timestamp - b.timestamp);

  $("attendanceSummary").innerHTML = `
    <div class="summary-chip">${records.length} Present</div>
    <div class="summary-chip">${escapeHtml(session.subject)}</div>
    <div class="summary-chip">${escapeHtml(session.className)}</div>
  `;

  if (!records.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;color:#94a3b8;padding:25px">
          No students have marked attendance yet.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = records.map((record, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(record.studentName)}</td>
      <td>${escapeHtml(record.enrollment)}</td>
      <td>${escapeHtml(new Date(record.timestamp).toLocaleTimeString())}</td>
      <td><span class="present-badge">PRESENT</span></td>
    </tr>
  `).join("");
}

function loginStudent(name, enrollment) {
  currentStudent = {
    id: `student-${normalizeEnrollment(enrollment)}`,
    name: name.trim(),
    enrollment: normalizeEnrollment(enrollment)
  };

  save(STORAGE_KEYS.currentStudent, currentStudent);

  $("studentHeaderName").textContent =
    `${currentStudent.name} • ${currentStudent.enrollment}`;

  showOnly("studentDashboard");
  renderStudentHistory();
  $("studentSessionId").value = "";
  $("studentCode").value = "";
  $("studentTimer").textContent = "Enter a session ID";
  $("studentTimer").className = "timer neutral";
}

function loginTeacher(name) {
  currentTeacher = {
    id: "teacher-" + name.trim().toLowerCase().replace(/\s+/g, "-"),
    name: name.trim()
  };

  save(STORAGE_KEYS.currentTeacher, currentTeacher);

  $("teacherHeaderName").textContent = currentTeacher.name;

  showOnly("teacherDashboard");
  renderTeacherSessions();
  $("teacherAttendanceCard").classList.add("hidden");
}

function logout() {
  currentStudent = null;
  currentTeacher = null;
  selectedSessionId = null;
  activeSessionId = null;

  localStorage.removeItem(STORAGE_KEYS.currentStudent);
  localStorage.removeItem(STORAGE_KEYS.currentTeacher);

  clearInterval(countdownInterval);
  clearInterval(studentTimerInterval);

  showOnly("loginPage");
  switchLoginRole("student");
}

function createTeacherSession() {
  if (!currentTeacher) {
    showToast("Please login as teacher.", "error");
    return;
  }

  const subject = $("subject").value.trim();
  const className = $("className").value.trim();

  if (!subject || !className) {
    showToast("Enter subject and class/division.", "error");
    return;
  }

  const now = Date.now();

  const session = {
    id: createId(),
    teacherId: currentTeacher.id,
    teacherName: currentTeacher.name,
    subject,
    className,
    code: createCode(),
    createdAt: now,
    expiresAt: now + SESSION_DURATION
  };

  sessions.push(session);
  save(STORAGE_KEYS.sessions, sessions);

  $("activeSessionBox").classList.remove("hidden");
  $("activeSessionId").textContent = session.id;
  $("activeCode").textContent = session.code;
  $("activeMeta").textContent = `${session.subject} • ${session.className}`;

  startTeacherCountdown(session);
  renderTeacherSessions();

  $("subject").value = "";
  $("className").value = "";

  showToast("Attendance session created.", "success");
}

function markAttendance() {
  if (!currentStudent) {
    showToast("Student session not found.", "error");
    return;
  }

  const sessionId = $("studentSessionId").value.trim();
  const code = $("studentCode").value.trim();

  if (!sessionId) {
    showToast("Enter the Session ID.", "error");
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    showToast("Enter a valid 6-digit code.", "error");
    return;
  }

  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    showToast("Session not found.", "error");
    return;
  }

  if (Date.now() >= session.expiresAt) {
    $("studentTimer").textContent = "SESSION EXPIRED";
    $("studentTimer").className = "timer danger";
    showToast("The 60-second session has expired.", "error");
    return;
  }

  const attemptKey = `${session.id}:${currentStudent.enrollment}`;
  wrongAttempts[attemptKey] = wrongAttempts[attemptKey] || 0;

  if (wrongAttempts[attemptKey] >= MAX_WRONG_ATTEMPTS) {
    showToast("Too many incorrect attempts for this session.", "error");
    return;
  }

  if (code !== session.code) {
    wrongAttempts[attemptKey]++;
    showToast("Incorrect attendance code.", "error");
    return;
  }

  const duplicate = attendance.some(record =>
    record.sessionId === session.id &&
    record.enrollment === currentStudent.enrollment
  );

  if (duplicate) {
    showToast("Attendance is already marked.", "error");
    return;
  }

  attendance.push({
    sessionId: session.id,
    subject: session.subject,
    className: session.className,
    teacherName: session.teacherName,
    studentName: currentStudent.name,
    enrollment: currentStudent.enrollment,
    timestamp: Date.now()
  });

  save(STORAGE_KEYS.attendance, attendance);

  $("studentCode").value = "";
  $("studentTimer").textContent = "Attendance marked successfully";
  $("studentTimer").className = "timer success";

  renderStudentHistory();
  showToast("Attendance marked successfully.", "success");

  if (selectedSessionId === session.id) {
    renderTeacherAttendance();
  }
}

function copyActiveSessionId() {
  const id = $("activeSessionId").textContent.trim();
  if (!id) return;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(id)
      .then(() => showToast("Session ID copied.", "success"))
      .catch(() => showToast("Could not copy Session ID.", "error"));
  } else {
    const area = document.createElement("textarea");
    area.value = id;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    showToast("Session ID copied.", "success");
  }
}

/* Events */
$("studentTab").addEventListener("click", () => switchLoginRole("student"));
$("teacherTab").addEventListener("click", () => switchLoginRole("teacher"));

$("studentLoginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("studentName").value.trim();
  const enrollment = $("studentEnrollment").value.trim();

  if (name.length < 2 || enrollment.length < 2) {
    showToast("Enter a valid name and enrollment number.", "error");
    return;
  }

  loginStudent(name, enrollment);
});

$("teacherLoginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("teacherName").value.trim();
  const password = $("teacherPassword").value;

  if (name.length < 2) {
    showToast("Enter teacher name.", "error");
    return;
  }

  if (password !== TEACHER_PASSWORD) {
    showToast("Incorrect teacher password.", "error");
    return;
  }

  loginTeacher(name);
});

$("studentLogout").addEventListener("click", logout);
$("teacherLogout").addEventListener("click", logout);

$("createSessionBtn").addEventListener("click", createTeacherSession);
$("copySessionBtn").addEventListener("click", copyActiveSessionId);
$("refreshAttendanceBtn").addEventListener("click", renderTeacherAttendance);

$("studentSessionId").addEventListener("input", startStudentTimer);

$("studentCode").addEventListener("input", (event) => {
  event.target.value = event.target.value.replace(/\D/g, "").slice(0, 6);
});

$("markAttendanceBtn").addEventListener("click", markAttendance);

/* Restore previous login */
if (currentStudent) {
  $("studentHeaderName").textContent =
    `${currentStudent.name} • ${currentStudent.enrollment}`;
  showOnly("studentDashboard");
  renderStudentHistory();
} else if (currentTeacher) {
  $("teacherHeaderName").textContent = currentTeacher.name;
  showOnly("teacherDashboard");
  renderTeacherSessions();
} else {
  showOnly("loginPage");
  switchLoginRole("student");
}
