// app.js
import { getPhotos, getPhotoById, setAuthToken } from './api-photos.js';
import { auth } from './auth.js';
import { config } from './config.js';
import { setItem, getItem, removeItem, clear } from './storage.js';
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

let currentPage = 1;
let isLoading = false;
let hasMorePhotos = true;
const objectURLs = new Set();
const PAGE_SIZE = 20;

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
  checkMasterKeyState();
}

async function checkMasterKeyState(forceRender = false) {
  const masterKey = await getItem('master_key');
  if (masterKey) {
    els.keyStatus.classList.remove('hidden');
    els.keyInputArea.classList.add('hidden');
    els.keyMsg.classList.add('hidden');
    if (forceRender || els.photoList.children.length === 0) {
      await renderPhotos();
    }
  } else {
    els.keyStatus.classList.add('hidden');
    els.keyInputArea.classList.remove('hidden');
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
  const password = document.getElementById('password').value.trim();

  try {
    const result = await auth.login(username, password);
    await setItem('auth_token', result.token);
    setAuthToken(result.token);
    showApp();
  } catch (err) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = err.message || 'Login failed';
    errorEl.classList.remove('hidden');
  }
});

els.logoutBtn.addEventListener('click', async () => {
  revokeAllObjectURLs();
  await clear();
  location.reload();
});

els.settingsBtn.addEventListener('click', () => {
  els.masterKeyPanel.classList.remove('hidden');
  els.masterKeyInput.focus();
  checkMasterKeyState();
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
    await setItem('master_key', key);
    els.keyMsg.textContent = 'Clé maître enregistrée ✓ Coffre déverrouillé';
    els.keyMsg.classList.remove('hidden', 'error-text');
    els.keyMsg.classList.add('success-text');

    setTimeout(() => {
      els.masterKeyPanel.classList.add('hidden');
      renderPhotos();
    }, 1400);
  } catch (err) {
    els.keyMsg.textContent = 'Échec de l’enregistrement de la clé';
    els.keyMsg.classList.remove('hidden', 'success-text');
    els.keyMsg.classList.add('error-text');
  }
});

els.changeKeyBtn.addEventListener('click', () => {
  els.keyStatus.classList.add('hidden');
  els.keyInputArea.classList.remove('hidden');
  els.masterKeyInput.value = '';
  els.masterKeyInput.focus();
});

// ────────────────────────────────────────────────
// Gallery Rendering
// ────────────────────────────────────────────────

async function renderPhotos(append = false) {
  if (isLoading) return;
  isLoading = true;

  if (!append) {
    revokeAllObjectURLs();
    els.photoList.innerHTML = '';
    currentPage = 1;
    hasMorePhotos = true;
  }

  els.loading.classList.remove('hidden');
  els.loading.innerHTML = '<div>Chargement de la galerie...</div>';

  try {
    const data = await getPhotos(currentPage, PAGE_SIZE);
    const masterKey = await getItem('master_key');

    if (!masterKey) {
      els.photoList.innerHTML = `
        <div class="gallery-locked-message">
          <i data-lucide="lock-keyhole"></i>
          <p>La galerie est verrouillée</p>
          <small>Ouvrez les paramètres pour entrer votre clé maître</small>
        </div>`;
      els.loading.classList.add('hidden');
      isLoading = false;
      lucide.createIcons();
      return;
    }

    for (const photo of data.photos || []) {
      const li = document.createElement('li');
      li.className = 'photo-card';
      li.dataset.id = photo._id;

      let contentHTML = getLockedPlaceholder();

      if (masterKey) {
        try {
          const blob = await PhotoDecryptor.decryptPhoto(photo, masterKey, 'thumbnail');
          const url = URL.createObjectURL(blob);
          objectURLs.add(url);
          contentHTML = `<img src="${url}" class="thumb" alt="${photo.filename || 'Photo'}">`;
        } catch (e) {
          console.warn('Échec décryptage vignette', photo.filename, e);
          // reste sur le placeholder verrouillé
        }
      }

      li.innerHTML = `
        ${contentHTML}
        <span class="filename">${photo.fileName || 'Document sans nom'}</span>
      `;

      if (masterKey) {
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => showDetail(photo._id));
      } else {
        li.style.cursor = 'not-allowed';
      }

      els.photoList.appendChild(li);
    }

    const received = data.photos?.length || 0;
    hasMorePhotos = received >= PAGE_SIZE || !!data.hasMore;
    els.loadMoreBtn.classList.toggle('hidden', !hasMorePhotos);

    currentPage++;
    lucide.createIcons();
  } catch (err) {
    console.error('Échec chargement photos', err);
    els.photoList.innerHTML += '<p class="error-text">Impossible de charger la galerie</p>';
  } finally {
    els.loading.classList.add('hidden');
    isLoading = false;
  }
}

function getLockedPlaceholder() {
  return `
    <div class="locked-document">
      <i data-lucide="file-lock"></i>
      <span class="locked-label">Verrouillé</span>
    </div>
  `;
}

els.loadMoreBtn.addEventListener('click', () => renderPhotos(true));

async function showDetail(id) {
  try {
    const photo = await getPhotoById(id);
    const masterKey = await getItem('master_key');

    let content = `<div class="helper-text">Clé maître requise pour voir l’image complète</div>`;

    if (masterKey) {
      try {
        const blob = await PhotoDecryptor.decryptPhoto(photo, masterKey, 'fullsize');
        const url = URL.createObjectURL(blob);
        objectURLs.add(url);
        content = `<img src="${url}" class="full-img" alt="${photo.filename || 'Photo'}">`;
      } catch (e) {
        console.warn('Échec décryptage image complète', id, e);
        content = `
          <div class="error-text">Échec du décryptage</div>
          <p class="helper-text">La clé maître semble incorrecte.<br>
          Essayez de la modifier dans Paramètres → Changer la clé.</p>
        `;
      }
    }

    els.detailModal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${photo.filename || 'Photo'}</h3>
          <button id="closeDetail" class="btn-ghost"><i data-lucide="x"></i></button>
        </div>
        ${content}
      </div>
    `;

    els.detailModal.classList.remove('hidden');

    document.getElementById('closeDetail').addEventListener('click', () => {
      els.detailModal.classList.add('hidden');
    }, { once: true });

    lucide.createIcons();
  } catch (err) {
    console.error('Échec affichage détail', err);
    els.detailModal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Erreur</h3>
          <button id="closeDetail" class="btn-ghost"><i data-lucide="x"></i></button>
        </div>
        <p class="error-text">Impossible de charger les détails de la photo.</p>
      </div>`;
    els.detailModal.classList.remove('hidden');
  }
}

window.addEventListener('beforeunload', revokeAllObjectURLs);