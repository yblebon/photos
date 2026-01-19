/**
 * External script for Photos PWA
 * Handles Auth, API integration, and UI rendering
 */

let allPhotos = [];
let selectedIds = new Set();
let isSelectMode = false;
let currentPage = 1;
let hasNextPage = false;

let API_BASE_URL = "";
let AUTH_BASE_URL = ""; // Loaded from config
let token = localStorage.getItem('auth_token');

// DOM Elements
const searchInput = document.getElementById('photo-search');
const photoGrid = document.getElementById('photo-grid');
const selectModeBtn = document.getElementById('select-mode-btn');
const downloadBar = document.getElementById('download-bar');
const selectCountLabel = document.getElementById('select-count');
const dlBtn = document.getElementById('dl-btn');
const authScreen = document.getElementById('auth-screen');

/**
 * Initialize App: Load config and check session
 */
async function initApp() {
  try {
    const response = await fetch('config.json');
    const config = await response.json();
    API_BASE_URL = config.API_BASE_URL;
    // Fallback if AUTH_BASE_URL isn't in config yet
    AUTH_BASE_URL = config.AUTH_BASE_URL || API_BASE_URL.replace('/api', '/auth');

    if (!token) {
      showAuth(true);
    } else {
      loadGallery();
    }
  } catch (e) {
    console.error("Initialization failed:", e);
  }
}

/**
 * Handle Authentication
 * FIX: Maps 'access_token' from response to prevent "Invalid credentials" error
 */
window.handleLogin = async () => {
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');

  if (!user || !pass) return alert("Please enter credentials");

  btn.innerText = "Authenticating...";
  btn.disabled = true;

  try {
    const res = await fetch(`${AUTH_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });

    const data = await res.json();
    
    // Check specifically for access_token as per your backend requirement
    if (res.ok && data.access_token) {
      token = data.access_token;
      localStorage.setItem('auth_token', token);
      showAuth(false);
      loadGallery();
    } else {
      alert(data.message || "Invalid credentials");
    }
  } catch (err) {
    alert("Authentication service unavailable");
  } finally {
    btn.innerText = "Sign In";
    btn.disabled = false;
  }
};

window.handleLogout = () => {
  localStorage.removeItem('auth_token');
  token = null;
  allPhotos = [];
  if (photoGrid) photoGrid.innerHTML = '';
  showAuth(true);
};

function showAuth(show) {
  if (authScreen) authScreen.classList.toggle('hidden', !show);
  if (window.lucide) lucide.createIcons();
}

/**
 * Fetch Photos with Authorization Header
 */
async function loadGallery(page = 1, append = false) {
  if (!API_BASE_URL || !token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/photos?page=${page}&limit=12`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) return handleLogout();

    const data = await res.json();
    const newPhotos = data.photos.map(p => ({
      id: p._id,
      name: p.fileName,
      url: `data:image/${p.thumbFormat};base64,${p.thumbnail}`,
      tags: ["Gallery"]
    }));

    allPhotos = append ? [...allPhotos, ...newPhotos] : newPhotos;
    currentPage = data.metadata.currentPage;
    hasNextPage = data.metadata.hasNextPage;

    renderPhotos(allPhotos);
    updateLoadMoreButton();
  } catch (e) {
    console.error("API Error:", e);
  }
}

/**
 * UI Rendering Logic
 */
function renderPhotos(photos) {
  if (!photoGrid) return;
  photoGrid.innerHTML = photos.map(photo => `
    <div class="photo-item ${selectedIds.has(photo.id) ? 'selected' : ''}" 
         ondblclick="handlePhotoSelect('${photo.id}')">
      <img src="${photo.url}" alt="${photo.name}" loading="lazy">
      <div class="select-indicator"><i data-lucide="check-circle-2"></i></div>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

function updateLoadMoreButton() {
  const existing = document.getElementById('load-more-container');
  if (existing) existing.remove();

  if (hasNextPage) {
    const container = document.createElement('div');
    container.id = 'load-more-container';
    container.innerHTML = `<button class="text-btn" onclick="loadGallery(${currentPage + 1}, true)">Load More</button>`;
    photoGrid.after(container);
  }
}

window.handlePhotoSelect = function(id) {
  if (!isSelectMode) isSelectMode = true;
  selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
  updateDownloadBar();
  renderPhotos(allPhotos);
};

window.toggleSelectMode = function() {
  isSelectMode = !isSelectMode;
  selectedIds.clear();
  if (selectModeBtn) selectModeBtn.innerText = isSelectMode ? 'Cancel' : 'Select';
  updateDownloadBar();
  renderPhotos(allPhotos);
};

function updateDownloadBar() {
  if (selectCountLabel) selectCountLabel.innerText = `${selectedIds.size} Selected`;
  selectedIds.size > 0 ? downloadBar.classList.remove('hidden') : downloadBar.classList.add('hidden');
}

window.downloadSelected = async function() {
  const originalText = dlBtn.innerHTML;
  dlBtn.disabled = true;
  dlBtn.innerText = "Processing...";
  const selected = allPhotos.filter(p => selectedIds.has(p.id));

  for (const p of selected) {
    const link = document.createElement('a');
    link.href = p.url;
    link.download = p.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    await new Promise(r => setTimeout(r, 400));
  }

  dlBtn.disabled = false;
  dlBtn.innerHTML = originalText;
  window.toggleSelectMode();
};

function applySearch(term) {
  const t = term.toLowerCase();
  const filtered = allPhotos.filter(p => p.name.toLowerCase().includes(t));
  renderPhotos(filtered);
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => applySearch(e.target.value));
}

document.addEventListener('DOMContentLoaded', initApp);