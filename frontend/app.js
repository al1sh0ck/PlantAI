// ─── Config ─────────────────────────────────────────────────
const API_URL = window.location.origin + "/api/v1";

// ─── State ──────────────────────────────────────────────────
let selectedFile  = null;
let authToken     = localStorage.getItem("plantai_token") || null;
let refreshToken  = localStorage.getItem("plantai_refresh") || null;
let currentUser   = JSON.parse(localStorage.getItem("plantai_user") || "null");

// ─── DOM ────────────────────────────────────────────────────
const dropZone   = document.getElementById("dropZone");
const fileInput  = document.getElementById("fileInput");
const analyzeBtn = document.getElementById("analyzeBtn");

// ─── Token refresh logic ─────────────────────────────────────
async function refreshAccessToken() {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error("Refresh failed");
    const data = await res.json();
    authToken = data.access_token;
    refreshToken = data.refresh_token;
    localStorage.setItem("plantai_token", authToken);
    localStorage.setItem("plantai_refresh", refreshToken);
    return true;
  } catch {
    return false;
  }
}

// Authenticated fetch — auto-refreshes on 401, forces logout if refresh fails
async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  options.headers["Authorization"] = `Bearer ${authToken}`;
  let res = await fetch(url, options);

  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      options.headers["Authorization"] = `Bearer ${authToken}`;
      res = await fetch(url, options);
    } else {
      showSessionExpired();
      return null;
    }
  }
  return res;
}

function showSessionExpired() {
  doLogout();
  // Show a noticeable banner
  const banner = document.getElementById("sessionBanner");
  if (banner) {
    banner.style.display = "flex";
    setTimeout(() => { banner.style.display = "none"; }, 5000);
  }
  openModal("login");
}

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
  document.getElementById("formLogin").style.display  = tab === "login"  ? "block" : "none";
  document.getElementById("formSignup").style.display = tab === "signup" ? "block" : "none";
}

// ─── Profile Modal ───────────────────────────────────────────
function openProfile() {
  document.getElementById("profileModal").classList.add("active");
  loadProfileData();
}

function closeProfile() {
  document.getElementById("profileModal").classList.remove("active");
}

async function loadProfileData() {
  if (!authToken || !currentUser) return;

  // Fill basic info
  document.getElementById("profileEmail").textContent    = currentUser.email || "—";
  document.getElementById("profileUsername").textContent = currentUser.username || "—";
  document.getElementById("profileJoined").textContent   = currentUser.id ? `#${currentUser.id}` : "—";

  // Load stats
  try {
    const res = await authFetch(`${API_URL}/users/me/stats`);
    if (res && res.ok) {
      const stats = await res.json();
      document.getElementById("statTotal").textContent   = stats.total_predictions || 0;
      const byClass = stats.by_class || {};
      // Count healthy vs diseased
      let healthy = 0, diseased = 0;
      Object.entries(byClass).forEach(([k, v]) => {
        if (k.toLowerCase().includes("healthy")) healthy += v;
        else diseased += v;
      });
      document.getElementById("statHealthy").textContent  = healthy;
      document.getElementById("statDiseased").textContent = diseased;
    }
  } catch(e) {}

  // Load full prediction history table
  try {
    const res = await authFetch(`${API_URL}/predictions?limit=50`);
    if (res && res.ok) {
      const predictions = await res.json();
      renderProfileHistory(predictions);
    }
  } catch(e) {}
}

function renderProfileHistory(predictions) {
  const tbody = document.getElementById("profileHistoryBody");
  if (!tbody) return;

  if (!predictions.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--gray-500);padding:2rem;">No analyses yet</td></tr>`;
    return;
  }

  tbody.innerHTML = predictions.map(p => {
    const isHealthy = p.predicted_class?.toLowerCase().includes("healthy");
    const badgeClass = isHealthy ? "severity-none" : (p.confidence > 70 ? "severity-high" : "severity-medium");
    const date = new Date(p.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
    return `<tr>
      <td>${date}</td>
      <td><span style="font-weight:500;">${p.display_name || p.predicted_class}</span></td>
      <td><span class="severity-badge ${badgeClass}" style="font-size:11px;">${isHealthy ? "✓ Healthy" : "⚠ Disease"}</span></td>
      <td>${p.confidence.toFixed(1)}%</td>
    </tr>`;
  }).join("");
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
    authToken    = data.access_token;
    refreshToken = data.refresh_token;
    localStorage.setItem("plantai_token", authToken);
    localStorage.setItem("plantai_refresh", refreshToken);
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
  authToken    = data.access_token;
  refreshToken = data.refresh_token;
  localStorage.setItem("plantai_token", authToken);
  localStorage.setItem("plantai_refresh", refreshToken);
  await fetchMe();
  closeModal();
}

async function fetchMe() {
  const res = await authFetch(`${API_URL}/auth/me`);
  if (res && res.ok) {
    currentUser = await res.json();
    localStorage.setItem("plantai_user", JSON.stringify(currentUser));
    updateAuthUI();
  }
}

function doLogout() {
  authToken    = null;
  refreshToken = null;
  currentUser  = null;
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
  if (!authToken) { openModal("login"); return; }

  analyzeBtn.classList.add("loading");
  analyzeBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);
    const res = await authFetch(`${API_URL}/predict`, {
      method: "POST",
      body: formData,
    });
    if (!res) return; // session expired, handled by authFetch
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Server error");
    }
    const data = await res.json();
    displayResults(data);
    loadHistory();
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
  const isHealthy = predictedClass.toLowerCase().includes("healthy");

  document.getElementById("disease-name").textContent   = disease_info.name;
  document.getElementById("disease-desc").textContent   = disease_info.description;
  document.getElementById("disease-causes").textContent = disease_info.causes;
  document.getElementById("chemical-rec").textContent   = disease_info.treatment.chemical || "Not specified";
  document.getElementById("organic-rec").textContent    = disease_info.treatment.organic  || "Not specified";

  // Severity badge
  const badge    = document.getElementById("severityBadge");
  const severity = disease_info.severity || (isHealthy ? "none" : "medium");
  badge.className = `severity-badge severity-${severity}`;
  badge.textContent = severity === "none" ? "✓ Healthy" : severity === "high" ? "⛔ Critical" : "⚠ Needs Attention";

  // Symptoms list
  const symptomsContainer = document.getElementById("symptoms-container");
  const symptomsList      = document.getElementById("symptoms-list");
  const symptoms = disease_info.symptoms || [];
  if (symptoms.length && !isHealthy) {
    symptomsContainer.style.display = "block";
    symptomsList.innerHTML = symptoms.map(s => `<li>${s}</li>`).join("");
  } else {
    symptomsContainer.style.display = "none";
  }

  // Health meter - hide for 15-class model
  const healthMeter = document.querySelector(".health-meter");
  if (healthMeter) healthMeter.style.display = "none";

  // Probability bars
  const allClasses = prediction.all_classes || [];
  const probBars   = document.getElementById("probBars");
  probBars.innerHTML = allClasses.map(item => {
    const colorClass = item.confidence > 50 ? "fill-green" : item.confidence > 20 ? "fill-amber" : "fill-red";
    return `<div class="prob-row">
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
    document.querySelectorAll(".prob-fill").forEach((bar, idx) => {
      if (allClasses[idx]) bar.style.width = allClasses[idx].confidence + "%";
    });
  }, 100);

  // Treatment lists
  document.getElementById("immediate-list").innerHTML =
    (disease_info.treatment.immediate || []).map(t => `<li>${t}</li>`).join("");
  document.getElementById("preventive-list").innerHTML =
    (disease_info.treatment.preventive || []).map(t => `<li>${t}</li>`).join("");

  // Meta chips
  const chips = [
    `<span class="meta-chip">⚡ ${meta.inference_ms}ms</span>`,
    `<span class="meta-chip">📐 ${meta.image_size || "auto"}</span>`,
    `<span class="meta-chip">🧠 ${meta.model || "EfficientNet-B0"}</span>`,
    `<span class="meta-chip">💻 ${(meta.device || "cpu").toUpperCase()}</span>`,
  ];
  if (meta.demo_mode) chips.push(`<span class="meta-chip demo-chip">⚠ Demo Mode</span>`);
  document.getElementById("metaRow").innerHTML = chips.join("");

  const resultsEl = document.getElementById("results");
  resultsEl.classList.add("active");
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Prediction History (sidebar) ────────────────────────────
async function loadHistory() {
  if (!authToken) return;
  try {
    const res = await authFetch(`${API_URL}/predictions?limit=10`);
    if (!res || !res.ok) return;
    const predictions = await res.json();
    renderHistory(predictions);
  } catch (e) {
    console.warn("Could not load history:", e);
  }
}

function renderHistory(predictions) {
  const list     = document.getElementById("historyList");
  const emptyMsg = document.getElementById("historyEmpty");
  if (!list) return;

  if (!predictions.length) {
    list.innerHTML = "";
    emptyMsg.style.display = "block";
    return;
  }
  emptyMsg.style.display = "none";

  list.innerHTML = predictions.map(p => {
    const isHealthy  = p.predicted_class?.toLowerCase().includes("healthy");
    const badgeClass = isHealthy ? "green" : (p.confidence > 70 ? "red" : "amber");
    const icon       = isHealthy ? "🌿" : (p.confidence > 70 ? "🍁" : "🍂");
    const date = new Date(p.created_at).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    return `<div class="history-item">
      <div class="history-badge ${badgeClass}">${icon}</div>
      <div class="history-info">
        <div class="history-name">${p.display_name || p.predicted_class}</div>
        <div class="history-conf">${p.confidence.toFixed(1)}% confidence</div>
      </div>
      <div class="history-date">${date}</div>
    </div>`;
  }).join("");
}

// ─── Disease Catalog ─────────────────────────────────────────
let allDiseases   = [];
let activeCropFilter = "all";

async function loadCatalog() {
  try {
    const res = await fetch(`${API_URL}/diseases`);
    const data = await res.json();
    allDiseases = data.diseases || data;
  } catch {
    allDiseases = getStaticCatalog();
  }
  buildCropFilters();
  renderCatalog(allDiseases);
}

function buildCropFilters() {
  const crops = new Set(["all"]);
  allDiseases.forEach(d => {
    const crop = getCropFromClass(d.id || d.name || "");
    if (crop) crops.add(crop);
  });

  const filterBar = document.getElementById("catalogFilters");
  if (!filterBar) return;
  filterBar.innerHTML = [...crops].map(crop =>
    `<button class="crop-filter-btn ${crop === "all" ? "active" : ""}"
      onclick="filterByCrop('${crop}')">${cropLabel(crop)}</button>`
  ).join("");
}

function getCropFromClass(classId) {
  const cl = classId.toLowerCase();
  if (cl.includes("tomato"))  return "tomato";
  if (cl.includes("potato"))  return "potato";
  if (cl.includes("pepper"))  return "pepper";
  if (cl.includes("corn") || cl.includes("maize")) return "corn";
  if (cl.includes("apple"))   return "apple";
  if (cl.includes("grape"))   return "grape";
  if (cl.includes("cherry"))  return "cherry";
  if (cl.includes("peach"))   return "peach";
  if (cl.includes("strawberry")) return "strawberry";
  return "other";
}

function cropLabel(crop) {
  const map = { all:"🌿 All", tomato:"🍅 Tomato", potato:"🥔 Potato", pepper:"🌶 Pepper",
    corn:"🌽 Corn", apple:"🍎 Apple", grape:"🍇 Grape", cherry:"🍒 Cherry",
    peach:"🍑 Peach", strawberry:"🍓 Strawberry", other:"🌱 Other" };
  return map[crop] || crop;
}

function filterByCrop(crop) {
  activeCropFilter = crop;
  document.querySelectorAll(".crop-filter-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
  const filtered = crop === "all" ? allDiseases : allDiseases.filter(d =>
    getCropFromClass(d.id || d.name || "") === crop
  );
  renderCatalog(filtered);
}

function renderCatalog(diseases) {
  if (!diseases || !diseases.length) {
    document.getElementById("catalogGrid").innerHTML = "<div class='card'>No diseases loaded</div>";
    return;
  }

  document.getElementById("catalogGrid").innerHTML = diseases.map(d => {
    const severity  = d.severity || "none";
    const isHealthy = severity === "none";
    const icon      = isHealthy ? "🌿" : (severity === "high" ? "🍁" : "🍂");
    const symptoms  = (d.symptoms || []).slice(0, 2).map(s => `<li>${s}</li>`).join("");
    const treatment = d.treatment?.immediate?.[0] || "";

    return `<div class="catalog-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div class="catalog-icon">${icon}</div>
        <span class="severity-badge severity-${severity}" style="font-size:11px;">
          ${isHealthy ? "✓ Healthy" : severity === "high" ? "⛔ Critical" : "⚠ Disease"}
        </span>
      </div>
      <div class="catalog-name">${d.name || d.id}</div>
      ${symptoms ? `<ul class="catalog-symptoms">${symptoms}</ul>` : ""}
      ${treatment ? `<div class="catalog-cure"><span class="cure-label">💊 Treatment:</span> ${treatment}</div>` : ""}
      <div class="catalog-desc">${(d.description || "").substring(0, 90)}${d.description?.length > 90 ? "..." : ""}</div>
    </div>`;
  }).join("");
}

function getStaticCatalog() {
  return [{ id: "loading", name: "Connect to backend to see diseases", severity: "none", description: "" }];
}

// ─── Mock fallback ───────────────────────────────────────────
function getMockResult() {
  return {
    prediction: {
      predicted_class: "Tomato_Late_blight",
      display_name: "Tomato - Late Blight",
      confidence: 87.4,
      severity: "high",
      all_classes: [
        { class_name: "Tomato_Late_blight",   display_name: "Tomato - Late Blight",   confidence: 87.4 },
        { class_name: "Tomato_Early_blight",  display_name: "Tomato - Early Blight",  confidence: 8.2  },
        { class_name: "Tomato_healthy",        display_name: "Tomato - Healthy",        confidence: 4.4  },
      ],
    },
    disease_info: {
      name: "Tomato Late Blight",
      severity: "high",
      description: "Late blight is a serious fungal disease caused by Phytophthora infestans. It spreads rapidly in cool, wet conditions.",
      symptoms: ["Dark brown lesions on leaves", "White mold on leaf undersides", "Rapid plant collapse in humid conditions"],
      causes: "Phytophthora infestans (oomycete pathogen) thriving in cool, moist conditions (10–25°C, high humidity).",
      treatment: {
        immediate: ["Remove and destroy infected leaves immediately", "Stop overhead irrigation", "Apply copper-based fungicide"],
        preventive: ["Use certified disease-free seed", "Space plants for air circulation", "Apply preventive fungicide weekly in high-risk weather"],
        chemical: "Mancozeb 75WP at 2.5 g/L or Metalaxyl+Mancozeb at 2g/L every 7 days",
        organic: "Copper hydroxide spray (0.3%) every 5–7 days; remove affected tissue promptly",
      },
    },
    meta: { inference_ms: 187, image_size: "800x600", device: "cpu", model: "EfficientNet-B0", demo_mode: true },
  };
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // On load, if we have a refresh token but need to verify session
  if (currentUser && refreshToken) {
    // Silently verify token is still valid
    authFetch(`${API_URL}/auth/me`).then(res => {
      if (!res) return; // session expired, handled
      if (res.ok) res.json().then(u => {
        currentUser = u;
        localStorage.setItem("plantai_user", JSON.stringify(u));
        updateAuthUI();
      });
    }).catch(() => {});
  }
  updateAuthUI();
  loadCatalog();
});
