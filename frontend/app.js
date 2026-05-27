// ─── Config ─────────────────────────────────────────────────
const API_URL = window.location.origin + "/api/v1";

// ─── State ──────────────────────────────────────────────────
let selectedFile = null;
let authToken    = localStorage.getItem("plantai_token") || null;
let currentUser  = JSON.parse(localStorage.getItem("plantai_user") || "null");

// ─── DOM ────────────────────────────────────────────────────
const dropZone   = document.getElementById("dropZone");
const fileInput  = document.getElementById("fileInput");
const analyzeBtn = document.getElementById("analyzeBtn");

// ─── Auth UI ────────────────────────────────────────────────
function updateAuthUI() {
  const navAuth = document.getElementById("navAuth");
  const navUser = document.getElementById("navUser");
  const historySection = document.getElementById("historySection");

  if (currentUser) {
    navAuth.style.display = "none";
    navUser.style.display = "flex";
    document.getElementById("navUsername").textContent = "👤 " + currentUser.username;
    if (historySection) historySection.style.display = "block";
    loadHistory();
  } else {
    navAuth.style.display = "flex";
    navUser.style.display = "none";
    if (historySection) historySection.style.display = "none";
  }
}

function openModal(tab = "login") {
  document.getElementById("authModal").classList.add("active");
  switchTab(tab);
  document.getElementById("authError").classList.remove("active");
}

function closeModal() {
  document.getElementById("authModal").classList.remove("active");
}

function switchTab(tab) {
  document.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  document.getElementById("formLogin").style.display  = tab === "login"    ? "block" : "none";
  document.getElementById("formSignup").style.display = tab === "signup"   ? "block" : "none";
}

// ─── Auth API calls ─────────────────────────────────────────
async function doLogin(e) {
  e.preventDefault();
  const email    = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPass").value;
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    authToken = data.access_token;
    localStorage.setItem("plantai_token", authToken);
    localStorage.setItem("plantai_refresh", data.refresh_token);
    await fetchMe();
    closeModal();
  } catch (err) {
    showAuthError(err.message);
  }
}

async function doSignup(e) {
  e.preventDefault();
  const email    = document.getElementById("signupEmail").value;
  const username = document.getElementById("signupUsername").value;
  const password = document.getElementById("signupPass").value;
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Registration failed");
    // Auto-login after register
    await doLoginDirect(email, password);
  } catch (err) {
    showAuthError(err.message);
  }
}

async function doLoginDirect(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail);
  authToken = data.access_token;
  localStorage.setItem("plantai_token", authToken);
  localStorage.setItem("plantai_refresh", data.refresh_token);
  await fetchMe();
  closeModal();
}

async function fetchMe() {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (res.ok) {
    currentUser = await res.json();
    localStorage.setItem("plantai_user", JSON.stringify(currentUser));
    updateAuthUI();
  }
}

function doLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("plantai_token");
  localStorage.removeItem("plantai_refresh");
  localStorage.removeItem("plantai_user");
  updateAuthUI();
}

function showAuthError(msg) {
  const el = document.getElementById("authError");
  el.textContent = msg;
  el.classList.add("active");
}

// ─── File Handling ───────────────────────────────────────────
fileInput.addEventListener("change", e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});
dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) handleFile(f);
});

function handleFile(file) {
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById("previewImg").src = e.target.result;
    document.getElementById("previewName").textContent = file.name;
    document.getElementById("previewSize").textContent = (file.size / 1024).toFixed(1) + " KB";
    dropZone.style.display = "none";
    document.getElementById("previewContainer").classList.add("active");
    analyzeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  selectedFile = null;
  fileInput.value = "";
  dropZone.style.display = "flex";
  document.getElementById("previewContainer").classList.remove("active");
  analyzeBtn.disabled = true;
  document.getElementById("results").classList.remove("active");
}

// ─── Analyze ─────────────────────────────────────────────────
async function analyzeImage() {
  if (!selectedFile) return;

  if (!authToken) {
    openModal("login");
    return;
  }

  analyzeBtn.classList.add("loading");
  analyzeBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Server error");
    }
    const data = await response.json();
    displayResults(data);
    loadHistory(); // Refresh history after new prediction
  } catch (error) {
    console.warn("API unavailable, using demo result:", error.message);
    displayResults(getMockResult());
  } finally {
    analyzeBtn.classList.remove("loading");
    analyzeBtn.disabled = false;
  }
}


function displayResults(data) {
  const { prediction, disease_info, meta } = data;
  const predictedClass = prediction.predicted_class;
  const isHealthy = predictedClass.toLowerCase().includes('healthy');

  document.getElementById("disease-name").textContent   = disease_info.name;
  document.getElementById("disease-desc").textContent   = disease_info.description;
  document.getElementById("disease-causes").textContent = disease_info.causes;
  document.getElementById("chemical-rec").textContent   = disease_info.treatment.chemical;
  document.getElementById("organic-rec").textContent    = disease_info.treatment.organic;

  // Severity badge (теперь из disease_info)
  const badge = document.getElementById("severityBadge");
  const severity = disease_info.severity || (isHealthy ? "none" : "medium");
  badge.className = `severity-badge severity-${severity}`;

  let severityText = "";
  if (severity === "none") severityText = "✓ Healthy";
  else if (severity === "medium") severityText = "⚠ Needs Attention";
  else if (severity === "high") severityText = "⛔ Critical";
  badge.textContent = severityText;

  // УБРАТЬ health meter (он не нужен для 38 классов)
  // Просто скрыть или удалить из HTML
  const healthMeter = document.querySelector('.health-meter');
  if (healthMeter) healthMeter.style.display = 'none';

  // Probability bars (уже работает, но добавим динамические цвета)
  const allClasses = prediction.all_classes || [];
  const probBars = document.getElementById("probBars");
  probBars.innerHTML = allClasses.map(item => {
    // Динамический цвет по уверенности или random, но лучше использовать severity
    let colorClass = "fill-green";
    if (item.confidence > 70) colorClass = "fill-green";
    else if (item.confidence > 40) colorClass = "fill-amber";
    else colorClass = "fill-red";

    return `
      <div class="prob-row">
        <div class="prob-header">
          <span class="prob-label">${item.display_name}</span>
          <span class="prob-pct">${item.confidence.toFixed(1)}%</span>
        </div>
        <div class="prob-bar">
          <div class="prob-fill ${colorClass}" style="width:0%"></div>
        </div>
      </div>`;
  }).join("");

  setTimeout(() => {
    document.querySelectorAll('.prob-fill').forEach((bar, idx) => {
      if (allClasses[idx]) bar.style.width = allClasses[idx].confidence + "%";
    });
  }, 100);

  // Treatment lists
  document.getElementById("immediate-list").innerHTML =
    disease_info.treatment.immediate.map(t => `<li>${t}</li>`).join("");
  document.getElementById("preventive-list").innerHTML =
    disease_info.treatment.preventive.map(t => `<li>${t}</li>`).join("");

  // Meta chips (оставляем как есть)
  const chips = [
    `<span class="meta-chip">⚡ ${meta.inference_ms}ms</span>`,
    `<span class="meta-chip">📐 ${meta.image_size || "auto"}</span>`,
    `<span class="meta-chip">🧠 ${meta.model || "EfficientNet-B0"}</span>`,
    `<span class="meta-chip">💻 ${meta.device?.toUpperCase() || "CPU"}</span>`,
  ];
  if (meta.demo_mode) chips.push(`<span class="meta-chip demo-chip">⚠ Demo Mode</span>`);
  document.getElementById("metaRow").innerHTML = chips.join("");

  // Show results
  const resultsEl = document.getElementById("results");
  resultsEl.classList.add("active");
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Prediction History ──────────────────────────────────────
async function loadHistory() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_URL}/predictions`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return;
    const predictions = await res.json();
    renderHistory(predictions);
  } catch (e) {
    console.warn("Could not load history:", e);
  }
}

// ✅ ЗАМЕНИ НА ЭТО:
function renderHistory(predictions) {
  const list = document.getElementById("historyList");
  const emptyMsg = document.getElementById("historyEmpty");
  if (!list) return;

  if (!predictions.length) {
    list.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  list.innerHTML = predictions.map(p => {
    // Динамический бейдж на основе predicted_class
    const isHealthy = p.predicted_class?.toLowerCase().includes('healthy');
    let badgeClass = "green";
    let icon = "🌿";

    if (!isHealthy) {
      if (p.confidence > 70) { badgeClass = "red"; icon = "🍁"; }
      else { badgeClass = "amber"; icon = "🍂"; }
    }

    const date = new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return `
      <div class="history-item">
        <div class="history-badge ${badgeClass}">${icon}</div>
        <div class="history-info">
          <div class="history-name">${p.display_name || p.predicted_class}</div>
          <div class="history-conf">${p.confidence.toFixed(1)}% confidence</div>
        </div>
        <div class="history-date">${date}</div>
      </div>`;
  }).join("");
}

// ─── Catalog ─────────────────────────────────────────────────
async function loadCatalog() {
  let diseases;
  try {
    const res = await fetch(`${API_URL}/diseases`);
    const data = await res.json();
    diseases = data.diseases || data; // адаптация под формат
  } catch {
    diseases = getStaticCatalog();
  }
  renderCatalog(diseases);
}

function getStaticCatalog() {
  return [
    { id: "example_1", name: "Loading diseases...", severity: "none", description: "Connect to backend to see 38 disease classes" },
  ];
}

const CATALOG_ICONS   = { healthy: "🌿", partially_healthy: "🍂", unhealthy: "🍁" };
const CATALOG_BORDERS = { none: "var(--green-mid)", medium: "var(--amber)", high: "var(--red)" };

function renderCatalog(diseases) {
  if (!diseases || !diseases.length) {
    document.getElementById("catalogGrid").innerHTML = '<div class="card">No diseases loaded</div>';
    return;
  }

  document.getElementById("catalogGrid").innerHTML = diseases.slice(0, 12).map(d => `
    <div class="catalog-card">
      <div class="catalog-icon">🌿</div>
      <div class="catalog-name">${d.name || d.id}</div>
      <span class="severity-badge severity-${d.severity || 'none'}" style="margin-bottom:10px;font-size:11px;">
        ${d.severity === 'none' ? '✓ Healthy' : (d.severity + ' severity')}
      </span>
      <div class="catalog-desc">${(d.description || '').substring(0, 100)}...</div>
    </div>
  `).join("");
}

// ─── Mock fallback ───────────────────────────────────────────
function getMockResult() {
  return {
    prediction: {
      predicted_class: "Partially_Healthy",
      display_name: "Partially Healthy Plant",
      confidence: 78.4,
      severity: "medium",
      all_classes: [
        { class_name: "Partially_Healthy", display_name: "Partially Healthy", confidence: 78.4 },
        { class_name: "Unhealthy",         display_name: "Unhealthy",         confidence: 14.2 },
        { class_name: "Healthy",           display_name: "Healthy",           confidence: 7.4  },
      ],
    },
    disease_info: {
      name: "Partially Healthy Plant",
      severity: "medium",
      description: "The plant shows early signs of stress or disease. Some areas are affected but the majority of tissue is still intact.",
      causes: "Early disease infection, mild nutrient deficiency, or environmental stress.",
      treatment: {
        immediate: ["Remove infected leaves", "Improve air circulation", "Adjust watering"],
        preventive: ["Monitor every 3–5 days", "Apply preventive fungicide if needed"],
        chemical: "Azoxystrobin 23SC at 1 mL/L if fungal signs present",
        organic: "Neem oil (2%) spray every 7 days",
      },
    },
    meta: { inference_ms: 234, image_size: "800x600", device: "cpu", model: "EfficientNet-B0", demo_mode: true },
  };
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateAuthUI();
  loadCatalog();
});
