/**
 * StorageLibrary – IndexedDB wrapper for secure-ish named key/value storage.
 * Supports multiple named keys (e.g. "auth_token", "master_key").
 */
class StorageLibrary {
  constructor() {
    this.DB_NAME = 'PhotoVaultDB';
    this.DB_VERSION = 1;
    this.STORE_NAME = 'keyValueStore';
    this.dbPromise = null;
  }

  openDB() {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('[Storage] Open failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });

    return this.dbPromise;
  }

  async setItem(keyName, value) {
    if (!keyName || value === undefined) throw new Error('Key name and value required');
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.put({ id: keyName, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); this.dbPromise = null; };
    });
  }

  async getItem(keyName) {
    if (!keyName) throw new Error('Key name required');
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.get(keyName);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); this.dbPromise = null; };
    });
  }

  async removeItem(keyName) {
    if (!keyName) throw new Error('Key name required');
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.delete(keyName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); this.dbPromise = null; };
    });
  }

  async clear() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); this.dbPromise = null; };
    });
  }
}

export const storage = new StorageLibrary();

export const saveToken    = (token) => storage.setItem('auth_token', token);
export const getToken     = ()       => storage.getItem('auth_token');
export const deleteToken  = ()       => storage.removeItem('auth_token');
export const clearAuth    = ()       => storage.clear();

export const setItem    = (k, v) => storage.setItem(k, v);
export const getItem    = (k)    => storage.getItem(k);
export const removeItem = (k)    => storage.removeItem(k);
export const clear      = ()     => storage.clear();