/* ============================================================
   واجباتي — Application Logic
   ============================================================ */

const APP_NAME = "واجباتي";
const STORAGE_USERS = "wa_users_v1";
const STORAGE_SESSION = "wa_session_v1";
const userDataKey = (uid) => `wa_userdata_${uid}_v1`;

/* ---------- State ---------- */
let state = {
  user: null,
  data: null,        // current user's data object
  view: "dashboard",
  filters: {
    status: "all",   // all | todo | inprogress | done | overdue
    priority: "all", // all | high | medium | low
    course: "all",
    search: "",
    sort: "due-asc", // due-asc | due-desc | created-desc | priority
  },
  sidebarOpen: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Storage helpers ---------- */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_USERS) || "[]"); }
  catch { return []; }
}
function setUsers(u) { localStorage.setItem(STORAGE_USERS, JSON.stringify(u)); }

function getSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SESSION) || "null"); }
  catch { return null; }
}
function setSession(s) {
  if (s) localStorage.setItem(STORAGE_SESSION, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_SESSION);
}

function defaultUserData() {
  return {
    assignments: [],
    profile: { name: "", bio: "" },
    settings: { theme: "light" },
    activity: [],
  };
}
function loadUserData(uid) {
  try {
    const raw = localStorage.getItem(userDataKey(uid));
    if (!raw) return defaultUserData();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultUserData(), parsed, {
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
    });
  } catch { return defaultUserData(); }
}
function saveUserData(uid, data) {
  localStorage.setItem(userDataKey(uid), JSON.stringify(data));
}
function persist() {
  if (state.user && state.data) saveUserData(state.user.id, state.data);
}

/* ---------- Crypto ---------- */
async function hashPassword(pw) {
  try {
    if (window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder().encode(pw);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return "sha256_" + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) { /* fall through */ }
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = (h << 5) - h + pw.charCodeAt(i); h |= 0; }
  return "f_" + Math.abs(h).toString(36) + "_" + pw.length;
}

function uid() {
  return "a_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

/* ---------- Toast ---------- */
function toast(msg, type = "info") {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const icons = { success: "✓", danger: "✕", info: "ℹ", warning: "!" };
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.innerHTML = `<span style="font-weight:800;">${icons[type] || "ℹ"}</span><span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(20px)";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* ---------- Modal ---------- */
function openModal(html) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("open"));
  let keyHandler = null;
  const close = () => {
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    backdrop.classList.remove("open");
    setTimeout(() => backdrop.remove(), 200);
  };
  keyHandler = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", keyHandler);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  const closeBtn = backdrop.querySelector("[data-close]");
  if (closeBtn) closeBtn.onclick = close;
  return { backdrop, close };
}

function confirmModal(title, text, okLabel = "تأكيد", danger = true) {
  return new Promise(resolve => {
    const { backdrop, close } = openModal(`
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(title)}</div>
        <button class="modal-close" data-close>✕</button>
      </div>
      <div class="modal-body">
        <p class="text-muted" style="margin:0;">${escapeHtml(text)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${escapeHtml(okLabel)}</button>
        <button class="btn btn-ghost" data-cancel>إلغاء</button>
      </div>`);
    const finish = (r) => { close(); resolve(r); };
    backdrop.querySelector("[data-cancel]").onclick = () => finish(false);
    backdrop.querySelector("[data-ok]").onclick = () => finish(true);
  });
}

/* ---------- Utils ---------- */
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
function uid2() { return uid(); }

function initials(emailOrName) {
  const s = (emailOrName || "").trim();
  if (!s) return "?";
  const parts = s.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  } catch { return new Date(ts).toLocaleDateString(); }
}
function formatDateTime(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  } catch { return new Date(ts).toLocaleString(); }
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isOverdue(a) {
  if (!a.dueDate || a.status === "done") return false;
  return a.dueDate < todayStr();
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayStr() + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

const PRIORITY_LABEL = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
const STATUS_LABEL = { todo: "قيد الانتظار", inprogress: "قيد التنفيذ", done: "مكتملة" };
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/* ---------- Assignments data helpers ---------- */
function getAssignments() {
  return (state.data && Array.isArray(state.data.assignments)) ? state.data.assignments : [];
}
function setAssignments(list) {
  state.data.assignments = list;
  persist();
}
function findAssignment(id) {
  return getAssignments().find(a => a.id === id) || null;
}

function courses() {
  const set = new Set();
  getAssignments().forEach(a => { if (a.course) set.add(a.course); });
  return [...set].sort();
}

/* ---------- Auth ---------- */
function renderAuth(mode = "login") {
  const app = $("#app");
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="logo">✅</div>
          <h1>واجباتي</h1>
          <p>منصتك الشخصية لإدارة الواجبات والمهام — آمنة، خاصة، ومتاحة في كل وقت.</p>
        </div>
        <div class="auth-tabs">
          <div class="auth-tab ${mode === "login" ? "active" : ""}" data-tab="login">تسجيل الدخول</div>
          <div class="auth-tab ${mode === "register" ? "active" : ""}" data-tab="register">إنشاء حساب</div>
        </div>
        <form class="auth-form ${mode === "login" ? "active" : ""}" id="loginForm">
          <div class="field">
            <label for="loginEmail">البريد الإلكتروني</label>
            <input class="input" id="loginEmail" type="email" required placeholder="example@email.com" autocomplete="email" />
          </div>
          <div class="field">
            <label for="loginPassword">كلمة المرور</label>
            <input class="input" id="loginPassword" type="password" required minlength="4" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <div id="loginError"></div>
          <button type="submit" class="btn btn-primary btn-block btn-lg">دخول</button>
        </form>
        <form class="auth-form ${mode === "register" ? "active" : ""}" id="registerForm">
          <div class="field">
            <label for="regName">الاسم الكامل (اختياري)</label>
            <input class="input" id="regName" type="text" placeholder="اسمك" autocomplete="name" />
          </div>
          <div class="field">
            <label for="regEmail">البريد الإلكتروني</label>
            <input class="input" id="regEmail" type="email" required placeholder="example@email.com" autocomplete="email" />
          </div>
          <div class="field">
            <label for="regPassword">كلمة المرور</label>
            <input class="input" id="regPassword" type="password" required minlength="4" placeholder="4 أحرف على الأقل" autocomplete="new-password" />
          </div>
          <div class="field">
            <label for="regPassword2">تأكيد كلمة المرور</label>
            <input class="input" id="regPassword2" type="password" required minlength="4" placeholder="••••••••" autocomplete="new-password" />
          </div>
          <div id="registerError"></div>
          <button type="submit" class="btn btn-primary btn-block btn-lg">إنشاء الحساب</button>
        </form>
        <div class="auth-footer">
          ${mode === "login"
            ? "لا تملك حساباً؟ أنشئ واحداً من الأعلى."
            : "لديك حساب؟ سجّل دخولك من الأعلى."}
        </div>
      </div>
    </div>`;

  $$(".auth-tab", app).forEach(t => {
    t.onclick = () => renderAuth(t.dataset.tab);
  });

  const loginForm = $("#loginForm", app);
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const errBox = $("#loginError", app);
    errBox.innerHTML = "";
    const email = $("#loginEmail", app).value.trim().toLowerCase();
    const pw = $("#loginPassword", app).value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr(errBox, "يرجى إدخال بريد إلكتروني صالح.");
    if (pw.length < 4) return showErr(errBox, "كلمة المرور يجب أن تكون 4 أحرف على الأقل.");
    const users = getUsers();
    const user = users.find(u => u.email === email);
    if (!user) return showErr(errBox, "لا يوجد حساب بهذا البريد.");
    const hash = await hashPassword(pw);
    if (hash !== user.passwordHash) return showErr(errBox, "كلمة المرور غير صحيحة.");
    loginSuccess(user);
  };

  const registerForm = $("#registerForm", app);
  registerForm.onsubmit = async (e) => {
    e.preventDefault();
    const errBox = $("#registerError", app);
    errBox.innerHTML = "";
    const name = $("#regName", app).value.trim();
    const email = $("#regEmail", app).value.trim().toLowerCase();
    const pw = $("#regPassword", app).value;
    const pw2 = $("#regPassword2", app).value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr(errBox, "يرجى إدخال بريد إلكتروني صالح.");
    if (pw.length < 4) return showErr(errBox, "كلمة المرور يجب أن تكون 4 أحرف على الأقل.");
    if (pw !== pw2) return showErr(errBox, "كلمتا المرور غير متطابقتين.");
    const users = getUsers();
    if (users.some(u => u.email === email)) return showErr(errBox, "هذا البريد مسجل مسبقاً.");
    const hash = await hashPassword(pw);
    const newUser = { id: uid(), name: name || email.split("@")[0], email, passwordHash: hash, createdAt: Date.now() };
    users.push(newUser);
    setUsers(users);
    saveUserData(newUser.id, defaultUserData());
    loginSuccess(newUser);
    toast("تم إنشاء الحساب بنجاح", "success");
  };

  function showErr(box, m) {
    box.innerHTML = `<div class="alert alert-danger" style="margin-top:12px;">${escapeHtml(m)}</div>`;
  }
}

function loginSuccess(user) {
  state.user = { id: user.id, email: user.email, name: user.name };
  setSession(state.user);
  state.data = loadUserData(user.id);
  state.view = "dashboard";
  state.filters = { status: "all", priority: "all", course: "all", search: "", sort: "due-asc" };
  state.sidebarOpen = false;
  renderApp();
  toast("مرحباً، " + (user.name || user.email), "success");
}

function logout() {
  setSession(null);
  state.user = null;
  state.data = null;
  renderAuth("login");
  toast("تم تسجيل الخروج", "info");
}

/* ---------- App shell ---------- */
function renderApp() {
  const app = $("#app");
  app.innerHTML = `
    <div class="app">
      <aside class="sidebar ${state.sidebarOpen ? "open" : ""}" id="sidebar">
        <div class="sidebar-brand">
          <div class="logo">✅</div>
          <div class="brand-text">
            <div class="brand-name">واجباتي</div>
            <div class="brand-sub">My Assignments</div>
          </div>
        </div>
        <div class="sidebar-search">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input class="input" id="globalSearch" type="text" placeholder="بحث سريع..." />
          </div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-label">التنقل</div>
          <div class="nav-item ${state.view === "dashboard" ? "active" : ""}" data-view="dashboard">
            <span class="icon">🏠</span> لوحة التحكم
          </div>
          <div class="nav-item ${state.view === "assignments" ? "active" : ""}" data-view="assignments">
            <span class="icon">📋</span> الواجبات
            <span class="badge">${getAssignments().length}</span>
          </div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-label">الحالة</div>
          ${renderStatusNav()}
        </div>
        <div class="sidebar-section" id="coursesSection">
          <div class="sidebar-label">المقررات</div>
          ${renderCoursesNav()}
        </div>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="avatar">${escapeHtml(initials(state.user.name || state.user.email))}</div>
            <div class="info">
              <div class="name">${escapeHtml(state.user.name || state.user.email.split("@")[0])}</div>
              <div class="email">${escapeHtml(state.user.email)}</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-block btn-sm" id="logoutBtn" style="margin-top:10px;color:#cbd5e1;border-color:rgba(255,255,255,0.12);">تسجيل الخروج</button>
        </div>
      </aside>
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <div class="main">
        <header class="header">
          <div class="header-left">
            <button class="icon-btn" id="menuBtn" title="القائمة">☰</button>
            <div>
              <div class="header-title">${state.view === "dashboard" ? "لوحة التحكم" : "الواجبات"}</div>
              <div class="header-subtitle">${headerSubtitle()}</div>
            </div>
          </div>
          <div class="header-right">
            <button class="btn btn-accent" id="newAssignmentBtn">+ واجب جديد</button>
          </div>
        </header>
        <div class="content" id="contentArea"></div>
      </div>
    </div>`;

  // events
  $$(".nav-item[data-view]", app).forEach(el => {
    el.onclick = () => { state.view = el.dataset.view; state.sidebarOpen = false; renderApp(); };
  });
  $$(".nav-item[data-status]", app).forEach(el => {
    el.onclick = () => {
      state.view = "assignments";
      state.filters.status = el.dataset.status;
      state.sidebarOpen = false;
      renderApp();
    };
  });
  $$(".nav-item[data-course]", app).forEach(el => {
    el.onclick = () => {
      state.view = "assignments";
      state.filters.course = el.dataset.course;
      state.sidebarOpen = false;
      renderApp();
    };
  });
  const menuBtn = $("#menuBtn");
  if (menuBtn) menuBtn.onclick = () => { state.sidebarOpen = !state.sidebarOpen; renderApp(); };
  const overlay = $("#sidebarOverlay");
  if (overlay) overlay.onclick = () => { state.sidebarOpen = false; renderApp(); };
  const logoutBtn = $("#logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
  const newBtn = $("#newAssignmentBtn");
  if (newBtn) newBtn.onclick = () => openAssignmentModal();
  const gs = $("#globalSearch");
  if (gs) {
    gs.value = state.filters.search;
    gs.oninput = () => {
      state.filters.search = gs.value;
      const changed = state.view !== "assignments";
      if (changed) state.view = "assignments";
      renderContent();
      updateHeaderSubtitle();
      $$(".nav-item[data-view]").forEach(el => el.classList.toggle("active", el.dataset.view === state.view));
      const gs2 = document.getElementById("globalSearch");
      if (gs2) { gs2.focus(); gs2.setSelectionRange(gs2.value.length, gs2.value.length); }
    };
  }

  renderContent();
}

function headerSubtitle() {
  const list = getAssignments();
  const pending = list.filter(a => a.status !== "done").length;
  const overdue = list.filter(isOverdue).length;
  if (state.view === "dashboard") return `${list.length} واجب · ${pending} قيد العمل · ${overdue} متأخر`;
  return `${filteredAssignments().length} من ${list.length} واجب`;
}

function renderStatusNav() {
  const list = getAssignments();
  const counts = {
    all: list.length,
    todo: list.filter(a => a.status === "todo").length,
    inprogress: list.filter(a => a.status === "inprogress").length,
    done: list.filter(a => a.status === "done").length,
    overdue: list.filter(isOverdue).length,
  };
  const items = [
    { key: "all", icon: "📚", label: "الكل" },
    { key: "todo", icon: "⏳", label: "قيد الانتظار" },
    { key: "inprogress", icon: "🔄", label: "قيد التنفيذ" },
    { key: "done", icon: "✅", label: "مكتملة" },
    { key: "overdue", icon: "⚠️", label: "متأخرة" },
  ];
  return items.map(it => `
    <div class="nav-item ${state.view === "assignments" && state.filters.status === it.key ? "active" : ""}" data-status="${it.key}">
      <span class="icon">${it.icon}</span> ${it.label}
      <span class="badge">${counts[it.key]}</span>
    </div>`).join("");
}

function renderCoursesNav() {
  const cs = courses();
  if (cs.length === 0) return `<div style="padding:6px 12px;font-size:12px;color:#64748b;">لا توجد مقررات بعد</div>`;
  return cs.map(c => {
    const n = getAssignments().filter(a => a.course === c).length;
    return `<div class="nav-item ${state.view === "assignments" && state.filters.course === c ? "active" : ""}" data-course="${escapeAttr(c)}">
      <span class="icon">📘</span> ${escapeHtml(c)}
      <span class="badge">${n}</span>
    </div>`;
  }).join("") + `<div class="nav-item ${state.filters.course === "all" ? "" : ""}" data-course="all" style="color:#94a3b8;font-size:12px;">
      <span class="icon">↺</span> إظهار الكل
    </div>`;
}

function syncSidebarActive() {
  // re-render sidebar active states without full re-render
  // simple: re-render app
}

function renderContent() {
  const area = $("#contentArea");
  if (!area) return;
  if (state.view === "dashboard") renderDashboard(area);
  else renderAssignments(area);
}

/* ---------- Filtering ---------- */
function filteredAssignments() {
  let list = [...getAssignments()];
  const f = state.filters;
  // status
  if (f.status === "overdue") list = list.filter(isOverdue);
  else if (f.status !== "all") list = list.filter(a => a.status === f.status);
  // priority
  if (f.priority !== "all") list = list.filter(a => a.priority === f.priority);
  // course
  if (f.course !== "all") list = list.filter(a => a.course === f.course);
  // search
  const q = (f.search || "").trim().toLowerCase();
  if (q) list = list.filter(a => (a.title + " " + (a.course || "") + " " + (a.description || "")).toLowerCase().includes(q));
  // sort
  list.sort((a, b) => {
    switch (f.sort) {
      case "due-asc": {
        const da = a.dueDate || "9999-12-31";
        const db = b.dueDate || "9999-12-31";
        if (da !== db) return da < db ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      case "due-desc": {
        const da = a.dueDate || "";
        const db = b.dueDate || "";
        if (da !== db) return da > db ? -1 : 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      case "created-desc":
        return (b.createdAt || 0) - (a.createdAt || 0);
      case "priority":
        if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1;
      default: return 0;
    }
  });
  return list;
}

/* ---------- Dashboard ---------- */
function renderDashboard(area) {
  const list = getAssignments();
  const total = list.length;
  const done = list.filter(a => a.status === "done").length;
  const pending = list.filter(a => a.status !== "done").length;
  const overdue = list.filter(isOverdue).length;
  const inprog = list.filter(a => a.status === "inprogress").length;
  const rate = total ? Math.round((done / total) * 100) : 0;

  // upcoming (next 7 days, not done)
  const upcoming = list
    .filter(a => a.status !== "done" && a.dueDate)
    .map(a => ({ a, d: daysUntil(a.dueDate) }))
    .filter(x => x.d !== null && x.d >= 0 && x.d <= 7)
    .sort((x, y) => x.d - y.d)
    .slice(0, 6);

  const recent = [...list].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 5);

  area.innerHTML = `
    <div class="greeting">
      <h2>مرحباً، ${escapeHtml(state.user.name || state.user.email.split("@")[0])} 👋</h2>
      <p>إليك ملخص واجباتك اليوم — ${formatDate(Date.now())}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon primary">📋</div>
        <div>
          <div class="stat-value">${total}</div>
          <div class="stat-label">إجمالي الواجبات</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">⏳</div>
        <div>
          <div class="stat-value">${pending}</div>
          <div class="stat-label">قيد العمل</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success">✅</div>
        <div>
          <div class="stat-value">${done}</div>
          <div class="stat-label">مكتملة (${rate}%)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger">⚠️</div>
        <div>
          <div class="stat-value">${overdue}</div>
          <div class="stat-label">متأخرة</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon info">🔄</div>
        <div>
          <div class="stat-value">${inprog}</div>
          <div class="stat-label">قيد التنفيذ</div>
        </div>
      </div>
    </div>

    <div class="section-header">
      <h3>📅 المستحق قريباً (7 أيام)</h3>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" data-goto="assignments">عرض الكل</button>
      </div>
    </div>
    ${upcoming.length ? `<div class="upcoming-list">${upcoming.map(x => upcomingItemHtml(x.a, x.d)).join("")}</div>`
      : `<div class="empty-state" style="padding:30px;"><div class="icon">🎉</div><h3>لا توجد واجبات مستحقة قريباً</h3><p>أنت على المسار الصحيح!</p></div>`}

    <div style="height:24px;"></div>

    <div class="section-header">
      <h3>🕐 آخر التحديثات</h3>
    </div>
    ${recent.length ? `<div class="assignments-grid">${recent.map(assignmentCardHtml).join("")}</div>`
      : `<div class="empty-state"><div class="icon">📝</div><h3>لا توجد واجبات بعد</h3><p>ابدأ بإضافة واجبك الأول.</p><button class="btn btn-accent" onclick="openAssignmentModal()">+ واجب جديد</button></div>`}
  `;

  area.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => { state.view = b.dataset.goto; renderApp(); });
  area.querySelectorAll(".upcoming-item").forEach(el => {
    el.onclick = () => openAssignmentModal(el.dataset.id);
  });
  area.querySelectorAll(".assignment-card").forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest(".card-actions")) return;
      openAssignmentModal(el.dataset.id);
    };
  });
  area.querySelectorAll(".card-actions button").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.closest(".assignment-card").dataset.id;
      const action = btn.dataset.action;
      handleCardAction(id, action);
    };
  });
}

function upcomingItemHtml(a, d) {
  const dd = new Date(a.dueDate + "T00:00:00");
  const day = dd.getDate();
  const mon = dd.toLocaleDateString("ar-SA", { month: "short" });
  const dueText = d === 0 ? "اليوم" : d === 1 ? "غداً" : `خلال ${d} أيام`;
  return `
    <div class="upcoming-item" data-id="${escapeAttr(a.id)}">
      <div class="date-box"><div class="day">${day}</div><div class="mon">${mon}</div></div>
      <div class="info">
        <div class="title">${escapeHtml(a.title)}</div>
        <div class="sub">${escapeHtml(a.course || "بدون مقرر")} · ${dueText}</div>
      </div>
      <span class="prio-dot" style="background:${prioColor(a.priority)};"></span>
    </div>`;
}

/* ---------- Assignments view ---------- */
function renderAssignments(area) {
  const list = filteredAssignments();
  area.innerHTML = `
    <div class="filters-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input class="input" id="searchInput" type="text" placeholder="بحث في الواجبات..." value="${escapeAttr(state.filters.search)}" />
      </div>
      <div class="chip-group" id="priorityChips">
        ${chipHtml("priority", "all", "جميع الأولويات")}
        ${chipHtml("priority", "high", "🔴 عالية")}
        ${chipHtml("priority", "medium", "🟡 متوسطة")}
        ${chipHtml("priority", "low", "🟢 منخفضة")}
      </div>
      <select class="select" id="sortSelect" style="width:auto;min-width:160px;">
        <option value="due-asc" ${state.filters.sort === "due-asc" ? "selected" : ""}>الأقرب استحقاقاً</option>
        <option value="due-desc" ${state.filters.sort === "due-desc" ? "selected" : ""}>الأبعد استحقاقاً</option>
        <option value="created-desc" ${state.filters.sort === "created-desc" ? "selected" : ""}>الأحدث إضافة</option>
        <option value="priority" ${state.filters.sort === "priority" ? "selected" : ""}>حسب الأولوية</option>
      </select>
      ${state.filters.course !== "all" ? `<button class="chip active" id="clearCourse">المقرر: ${escapeHtml(state.filters.course)} ✕</button>` : ""}
      ${state.filters.status !== "all" ? `<button class="chip active" id="clearStatus">الحالة: ${escapeHtml(STATUS_LABEL[state.filters.status] || state.filters.status)} ✕</button>` : ""}
    </div>

    ${list.length === 0 ? emptyStateHtml() : `<div class="assignments-grid">${list.map(assignmentCardHtml).join("")}</div>`}
  `;

  const searchInput = $("#searchInput", area);
  if (searchInput) {
    searchInput.oninput = () => {
      state.filters.search = searchInput.value;
      renderContent();
      updateHeaderSubtitle();
      const si = document.getElementById("searchInput");
      if (si) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
    };
  }
  const sortSelect = $("#sortSelect", area);
  if (sortSelect) {
    sortSelect.onchange = () => { state.filters.sort = sortSelect.value; renderContent(); };
  }
  const clearCourse = $("#clearCourse", area);
  if (clearCourse) clearCourse.onclick = () => { state.filters.course = "all"; renderApp(); };
  const clearStatus = $("#clearStatus", area);
  if (clearStatus) clearStatus.onclick = () => { state.filters.status = "all"; renderApp(); };

  area.querySelectorAll(".chip[data-prio]").forEach(c => {
    c.onclick = () => { state.filters.priority = c.dataset.prio; renderContent(); syncChips(area); };
  });
  syncChips(area);

  area.querySelectorAll(".assignment-card").forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest(".card-actions")) return;
      openAssignmentModal(el.dataset.id);
    };
  });
  area.querySelectorAll(".card-actions button").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const card = btn.closest(".assignment-card");
      handleCardAction(card.dataset.id, btn.dataset.action);
    };
  });
  const emptyBtn = area.querySelector("[data-new]");
  if (emptyBtn) emptyBtn.onclick = () => openAssignmentModal();
}

function chipHtml(type, value, label) {
  const active = state.filters[type === "priority" ? "priority" : type] === value;
  return `<div class="chip ${active ? "active" : ""}" data-${type === "priority" ? "prio" : type}="${escapeAttr(value)}">${label}</div>`;
}
function syncChips(area) {
  area.querySelectorAll(".chip[data-prio]").forEach(c => {
    c.classList.toggle("active", c.dataset.prio === state.filters.priority);
  });
}

function emptyStateHtml() {
  const hasFilters = state.filters.status !== "all" || state.filters.priority !== "all" || state.filters.course !== "all" || state.filters.search.trim();
  if (hasFilters) {
    return `<div class="empty-state">
      <div class="icon">🔍</div>
      <h3>لا توجد نتائج</h3>
      <p>جرّب تغيير عوامل التصفية أو البحث.</p>
      <button class="btn btn-ghost" onclick="resetFilters()">إعادة تعيين التصفية</button>
    </div>`;
  }
  return `<div class="empty-state">
    <div class="icon">📝</div>
    <h3>لا توجد واجبات بعد</h3>
    <p>ابدأ بإضافة واجبك الأول لتتبعه.</p>
    <button class="btn btn-accent" data-new>+ واجب جديد</button>
  </div>`;
}
function resetFilters() {
  state.filters = { status: "all", priority: "all", course: "all", search: "", sort: state.filters.sort };
  renderApp();
}

function updateHeaderSubtitle() {
  const sub = $(".header-subtitle");
  if (sub) sub.textContent = headerSubtitle();
}

/* ---------- Assignment card html ---------- */
function assignmentCardHtml(a) {
  const overdue = isOverdue(a);
  const done = a.status === "done";
  const dueText = a.dueDate ? formatDueText(a.dueDate) : "بدون موعد";
  const dueClass = overdue ? "overdue" : (daysUntil(a.dueDate) !== null && daysUntil(a.dueDate) <= 2 ? "soon" : "");
  const prioClass = "prio-" + (a.priority || "medium");
  const statusClass = "status-" + (a.status || "todo");
  return `
    <div class="assignment-card ${done ? "done" : ""} ${overdue ? "overdue" : ""}" data-id="${escapeAttr(a.id)}">
      <div class="card-top">
        <div class="card-title">${escapeHtml(a.title)}</div>
        <div class="card-actions">
          <button class="icon-btn" data-action="toggle" title="${done ? "إلغاء الإكمال" : "تحديد كمكتمل"}">${done ? "↩" : "✓"}</button>
          <button class="icon-btn" data-action="delete" title="حذف">🗑</button>
        </div>
      </div>
      ${a.course ? `<div class="card-course"><span class="dot" style="background:${courseColor(a.course)};"></span>${escapeHtml(a.course)}</div>` : ""}
      ${a.description ? `<div class="card-desc">${escapeHtml(a.description)}</div>` : ""}
      <div class="card-meta">
        <span class="due ${dueClass}">📅 ${escapeHtml(dueText)}</span>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="prio-badge ${prioClass}">● ${PRIORITY_LABEL[a.priority] || "متوسطة"}</span>
          <span class="status-badge ${statusClass}">${STATUS_LABEL[a.status] || "قيد الانتظار"}</span>
        </div>
      </div>
    </div>`;
}

function formatDueText(dateStr) {
  const d = daysUntil(dateStr);
  const base = formatDate(new Date(dateStr + "T00:00:00").getTime());
  if (d === null) return base;
  if (d < 0) return `${base} (متأخر ${Math.abs(d)} يوم)`;
  if (d === 0) return `${base} (اليوم)`;
  if (d === 1) return `${base} (غداً)`;
  if (d <= 7) return `${base} (خلال ${d} أيام)`;
  return base;
}
function prioColor(p) {
  return p === "high" ? "var(--prio-high)" : p === "low" ? "var(--prio-low)" : "var(--prio-med)";
}
function courseColor(name) {
  // deterministic color from name
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
  return colors[h % colors.length];
}

/* ---------- Card actions ---------- */
function handleCardAction(id, action) {
  if (action === "toggle") toggleDone(id);
  else if (action === "delete") deleteAssignment(id);
}

function toggleDone(id) {
  const a = findAssignment(id);
  if (!a) return;
  a.status = a.status === "done" ? "todo" : "done";
  a.updatedAt = Date.now();
  persist();
  toast(a.status === "done" ? "تم تحديد الواجب كمكتمل" : "تم إعادة فتح الواجب", "success");
  renderApp();
}

function deleteAssignment(id) {
  const a = findAssignment(id);
  if (!a) return;
  confirmModal("حذف الواجب", `هل أنت متأكد من حذف "${a.title}"؟ لا يمكن التراجع عن هذا الإجراء.`, "حذف", true)
    .then(ok => {
      if (!ok) return;
      setAssignments(getAssignments().filter(x => x.id !== id));
      toast("تم حذف الواجب", "info");
      renderApp();
    });
}

/* ---------- Assignment modal (create/edit) ---------- */
function openAssignmentModal(id = null) {
  const existing = id ? findAssignment(id) : null;
  const isEdit = !!existing;
  const a = existing || {
    title: "", course: "", description: "", dueDate: "", priority: "medium", status: "todo",
  };

  const { backdrop, close } = openModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "تعديل الواجب" : "واجب جديد"}</div>
      <button class="modal-close" data-close>✕</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field full">
          <label for="aTitle">عنوان الواجب *</label>
          <input class="input" id="aTitle" type="text" required placeholder="مثال: بحث في فلسفة التربية" value="${escapeAttr(a.title)}" />
        </div>
        <div class="field">
          <label for="aCourse">المقرر / الدورة</label>
          <input class="input" id="aCourse" type="text" list="courseList" placeholder="مثال: فلسفات تربوية" value="${escapeAttr(a.course)}" />
          <datalist id="courseList">${courses().map(c => `<option value="${escapeAttr(c)}"></option>`).join("")}</datalist>
        </div>
        <div class="field">
          <label for="aDue">تاريخ الاستحقاق</label>
          <input class="input" id="aDue" type="date" value="${escapeAttr(a.dueDate || "")}" />
        </div>
        <div class="field">
          <label for="aPriority">الأولوية</label>
          <select class="select" id="aPriority">
            <option value="high" ${a.priority === "high" ? "selected" : ""}>🔴 عالية</option>
            <option value="medium" ${a.priority === "medium" || !a.priority ? "selected" : ""}>🟡 متوسطة</option>
            <option value="low" ${a.priority === "low" ? "selected" : ""}>🟢 منخفضة</option>
          </select>
        </div>
        <div class="field">
          <label for="aStatus">الحالة</label>
          <select class="select" id="aStatus">
            <option value="todo" ${a.status === "todo" || !a.status ? "selected" : ""}>⏳ قيد الانتظار</option>
            <option value="inprogress" ${a.status === "inprogress" ? "selected" : ""}>🔄 قيد التنفيذ</option>
            <option value="done" ${a.status === "done" ? "selected" : ""}>✅ مكتملة</option>
          </select>
        </div>
        <div class="field full">
          <label for="aDesc">الوصف / ملاحظات</label>
          <textarea class="textarea" id="aDesc" placeholder="تفاصيل الواجب، متطلبات، ملاحظات...">${escapeHtml(a.description)}</textarea>
        </div>
      </div>
      <div id="formError"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-primary" id="saveBtn">${isEdit ? "حفظ التغييرات" : "إضافة الواجب"}</button>
      <button class="btn btn-ghost" data-close>إلغاء</button>
      ${isEdit ? `<button class="btn btn-danger" id="deleteBtn" style="margin-right:auto;">حذف</button>` : ""}
    </div>`);

  const titleInput = backdrop.querySelector("#aTitle");
  setTimeout(() => titleInput && titleInput.focus(), 80);

  backdrop.querySelector("#saveBtn").onclick = () => {
    const errBox = backdrop.querySelector("#formError");
    errBox.innerHTML = "";
    const title = backdrop.querySelector("#aTitle").value.trim();
    if (!title) return showErr(errBox, "يرجى إدخال عنوان الواجب.");
    const course = backdrop.querySelector("#aCourse").value.trim();
    const dueDate = backdrop.querySelector("#aDue").value;
    const priority = backdrop.querySelector("#aPriority").value;
    const status = backdrop.querySelector("#aStatus").value;
    const description = backdrop.querySelector("#aDesc").value.trim();

    if (isEdit) {
      Object.assign(existing, { title, course, dueDate, priority, status, description, updatedAt: Date.now() });
    } else {
      const newA = {
        id: uid(),
        title, course, description, dueDate, priority, status,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const list = getAssignments();
      list.unshift(newA);
      setAssignments(list);
    }
    persist();
    toast(isEdit ? "تم حفظ التغييرات" : "تم إضافة الواجب", "success");
    close();
    renderApp();
  };

  const delBtn = backdrop.querySelector("#deleteBtn");
  if (delBtn) {
    delBtn.onclick = () => {
      close();
      deleteAssignment(existing.id);
    };
  }

  function showErr(box, m) {
    box.innerHTML = `<div class="alert alert-danger" style="margin-top:8px;">${escapeHtml(m)}</div>`;
  }
}

/* ---------- Boot ---------- */
(function boot() {
  const session = getSession();
  if (session && session.id && session.email) {
    const users = getUsers();
    const user = users.find(u => u.id === session.id && u.email === session.email);
    if (user) {
      state.user = { id: user.id, email: user.email, name: user.name };
      state.data = loadUserData(user.id);
      state.view = "dashboard";
      state.filters = { status: "all", priority: "all", course: "all", search: "", sort: "due-asc" };
      renderApp();
      return;
    }
  }
  renderAuth("login");
})();
