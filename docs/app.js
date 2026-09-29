// app.js
import { getPhotos, getPhotoById, setAuthToken, setSessionExpiredHandler } from './api-photos.js';
import { auth } from './auth.js';
import { config } from './config.js';
import { getItem, removeItem } from './storage.js';
import { PhotoDecryptor } from './decryptor.js';

const els = {
  authScreen:      document.getElementById('auth-screen'),
  app:             document.getElementById('app'),
  logoutBtn:       document.getElementById('logoutBtn'),
  settingsBtn:     document.getElementById('settingsBtn'),
  masterKeyPanel:  document.getElementById('master-key-panel'),
  closeSettings:   document.getElementById('closeSettings'),
  keyStatus:       document.getElementById('key-status'),
  keyInputArea:    document.getElementById('key-input-area'),
  keyForm:         document.getElementById('masterKeyForm'),
  masterKeyInput:  document.getElementById('masterKeyInput'),
  keyMsg:          document.getElementById('keyStatusMessage'),
  loading:         document.getElementById('loading'),
  photoList:       document.getElementById('photo-list'),
  loadMoreBtn:     document.getElementById('loadMore'),
  detailModal:     document.getElementById('detail-modal'),
  changeKeyBtn:    document.getElementById('changeKeyBtn')
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
}

/** Build an element safely (no innerHTML with server data). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}
const icon = (name) => h('i', { 'data-lucide': name });
const photoName = (p) => p.fileName || p.filename || '';

let currentPage = 1;
let isLoading = false;
let hasMorePhotos = true;
const objectURLs = new Set();
const PAGE_SIZE = 20;

// In-memory only – never persisted
let sessionMasterKey = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await config.getConfig();
    lucide.createIcons();

    const token = await getItem('auth_token');
    if (token) {
      setAuthToken(token);
      showApp();
    } else {
      showAuth();
    }
  } catch (err) {
    console.error('Initialization failed', err);
  }
});

function showAuth() {
  els.authScreen.classList.remove('hidden');
  els.app.classList.add('hidden');
  els.logoutBtn.classList.add('hidden');
  els.settingsBtn.classList.add('hidden');
  els.masterKeyPanel.classList.add('hidden');
}

function showApp() {
  els.authScreen.classList.add('hidden');
  els.app.classList.remove('hidden');
  els.logoutBtn.classList.remove('hidden');
  els.settingsBtn.classList.remove('hidden');

  // Automatically open unlock panel after login / reload
  els.masterKeyPanel.classList.remove('hidden');
  els.masterKeyInput.focus();
  updateKeyUIState();
}

function updateKeyUIState() {
  if (sessionMasterKey) {
    els.keyStatus.classList.remove('hidden');
    els.keyInputArea.classList.add('hidden');
    els.keyMsg.classList.add('hidden');
    if (els.photoList.children.length === 0) {
      renderPhotos();
    }
  } else {
    els.keyStatus.classList.add('hidden');
    els.keyInputArea.classList.remove('hidden');
    els.masterKeyPanel.classList.remove('hidden'); // ensure visible
  }
}

function revokeAllObjectURLs() {
  for (const url of objectURLs) {
    URL.revokeObjectURL(url);
  }
  objectURLs.clear();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const result = await auth.login(username, password);
    setAuthToken(result.token);
    showApp();
  } catch (err) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = err.message || 'Login failed';
    errorEl.classList.remove('hidden');
  }
});

async function logout() {
  revokeAllObjectURLs();
  sessionMasterKey = null;
  PhotoDecryptor.clearCache();
  setAuthToken(null);
  await removeItem('auth_token');
  location.reload();
}

els.logoutBtn.addEventListener('click', logout);
setSessionExpiredHandler(logout);

els.settingsBtn.addEventListener('click', () => {
  els.masterKeyPanel.classList.remove('hidden');
  els.masterKeyInput.focus();
  updateKeyUIState();
});

els.closeSettings.addEventListener('click', () => {
  els.masterKeyPanel.classList.add('hidden');
  els.keyMsg.classList.add('hidden');
});

els.keyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = els.masterKeyInput.value.trim();
  if (!key) return;

  try {
    // Minimal length check – you can strengthen this later
    if (key.length < 8) {
      throw new Error('La clé doit contenir au moins 8 caractères');
    }

    // Verify the key against the first stored photo before accepting it
    const first = await getPhotos(1, 1);
    const sample = first.photos && first.photos[0];
    if (sample) {
      try {
        await PhotoDecryptor.decryptPhoto(sample, key, 'thumbnail');
      } catch (_) {
        PhotoDecryptor.clearCache();
        throw new Error('Clé maître incorrecte');
      }
    }

    // Store only in memory for this session
    sessionMasterKey = key;

    els.keyMsg.textContent = 'Coffre déverrouillé ✓';
    els.keyMsg.classList.remove('hidden', 'error-text');
    els.keyMsg.classList.add('success-text');

    // Clear the input field immediately
    els.masterKeyInput.value = '';

    setTimeout(() => {
      els.masterKeyPanel.classList.add('hidden');
      renderPhotos();
    }, 1200);
  } catch (err) {
    els.keyMsg.textContent = err.message || 'Échec du déverrouillage';
    els.keyMsg.classList.remove('hidden', 'success-text');
    els.keyMsg.classList.add('error-text');
  }
});

els.changeKeyBtn?.addEventListener('click', () => {
  sessionMasterKey = null;
  PhotoDecryptor.clearCache();
  revokeAllObjectURLs();
  els.photoList.innerHTML = '';
  els.masterKeyInput.value = '';
  updateKeyUIState();
  els.masterKeyInput.focus();
});

// ────────────────────────────────────────────────
// Gallery Rendering
// ────────────────────────────────────────────────

async function renderPhotos(append = false) {
  if (isLoading) return;

  if (!sessionMasterKey) {
    revokeAllObjectURLs();
    els.photoList.replaceChildren(h('div', { class: 'gallery-locked-message' },
      icon('lock-keyhole'),
      h('p', {}, 'Le coffre est verrouillé'),
      h('small', {}, 'Cliquez sur Paramètres pour entrer votre clé maître')));
    els.loadMoreBtn.classList.add('hidden');
    lucide.createIcons();
    return;
  }

  isLoading = true;

  if (!append) {
    revokeAllObjectURLs();
    els.photoList.innerHTML = '';
    currentPage = 1;
    hasMorePhotos = true;
  }

  els.loading.classList.remove('hidden');
  els.loading.replaceChildren(h('div', {}, 'Chargement de la galerie...'));

  try {
    const data = await getPhotos(currentPage, PAGE_SIZE);

    for (const photo of data.photos || []) {
      const li = h('li', { class: 'photo-card' });
      li.dataset.id = photo._id;

      let thumb = getLockedPlaceholder();
      try {
        const blob = await PhotoDecryptor.decryptPhoto(photo, sessionMasterKey, 'thumbnail');
        const url = URL.createObjectURL(blob);
        objectURLs.add(url);
        thumb = h('img', { src: url, class: 'thumb', alt: photoName(photo) || 'Photo' });
      } catch (e) {
        console.warn('Échec décryptage vignette', photoName(photo), e);
      }

      li.append(thumb, h('span', { class: 'filename' }, photoName(photo) || 'Document sans nom'));
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => showDetail(photo._id));
      els.photoList.appendChild(li);
    }

    const received = data.photos?.length || 0;
    hasMorePhotos = received >= PAGE_SIZE || !!data.hasMore;
    els.loadMoreBtn.classList.toggle('hidden', !hasMorePhotos);

    currentPage++;
    lucide.createIcons();
  } catch (err) {
    console.error('Échec chargement photos', err);
    els.photoList.append(h('p', { class: 'error-text' }, 'Impossible de charger la galerie'));
  } finally {
    els.loading.classList.add('hidden');
    isLoading = false;
  }
}

function getLockedPlaceholder() {
  return h('div', { class: 'locked-document' },
    icon('file-lock'),
    h('span', { class: 'locked-label' }, 'Verrouillé'));
}

els.loadMoreBtn.addEventListener('click', () => renderPhotos(true));

const detailUrls = new Set();

function openModal(title, ...body) {
  for (const u of detailUrls) { URL.revokeObjectURL(u); objectURLs.delete(u); }
  detailUrls.clear();

  const closeBtn = h('button', { class: 'btn-ghost', 'aria-label': 'Fermer' }, icon('x'));
  closeBtn.addEventListener('click', () => els.detailModal.classList.add('hidden'));
  els.detailModal.replaceChildren(h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-header' }, h('h3', {}, title), closeBtn),
    ...body));
  els.detailModal.classList.remove('hidden');
  lucide.createIcons();
  closeBtn.focus();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') els.detailModal.classList.add('hidden');
});

async function showDetail(id) {
  try {
    const photo = await getPhotoById(id);
    const title = photoName(photo) || 'Photo';
    let content = h('div', { class: 'helper-text' }, 'Le coffre est verrouillé – entrez la clé maître dans Paramètres');
    let url = null;

    if (sessionMasterKey) {
      try {
        const blob = await PhotoDecryptor.decryptPhoto(photo, sessionMasterKey, 'fullsize');
        url = URL.createObjectURL(blob);
        objectURLs.add(url);
        content = h('img', { src: url, class: 'full-img', alt: title });
      } catch (e) {
        console.warn('Échec décryptage image complète', id, e);
        content = h('div', {},
          h('div', { class: 'error-text' }, 'Échec du décryptage'),
          h('p', { class: 'helper-text' }, 'Clé maître incorrecte ? Fermez cette fenêtre et réessayez dans Paramètres.'));
      }
    }

    openModal(title, content);
    if (url) detailUrls.add(url);
  } catch (err) {
    console.error('Échec affichage détail', err);
    openModal('Erreur', h('p', { class: 'error-text' }, 'Impossible de charger les détails de la photo.'));
  }
}

window.addEventListener('beforeunload', () => {
  sessionMasterKey = null;
  PhotoDecryptor.clearCache();
  revokeAllObjectURLs();
});