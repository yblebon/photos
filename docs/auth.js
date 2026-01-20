import { getAuthBaseUrl } from './config.js';
import { saveToken, deleteToken } from './storage.js';

/**
 * AuthLibrary
 * A library to handle Basic Authentication and token management.
 */
class AuthLibrary {
  constructor() {
    this.AUTH_LOGIN_PATH = '/login';
  }

  /**
   * Performs login using Basic Auth and saves the received token.
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<Object>} { token, user }
   */
  async login(username, password) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const base = await getAuthBaseUrl();
    const loginUrl = base + this.AUTH_LOGIN_PATH;

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        // Updated implementation: Sending credentials in the body
        body: JSON.stringify({ 
          username: username, 
          password: password 
        })
      });

      if (!response.ok) {
        let errText = 'Unknown error';
        try {
          const errData = await response.json();
          errText = errData.error || errData.message || response.statusText;
        } catch (e) {
          // Keep the original fallback logic
        }
        throw new Error(`Login failed: ${response.status} – ${errText}`);
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('No token received from server');
      }

      // Store in IndexedDB as per original implementation
      await saveToken(data.access_token);
      console.log('[Auth] Login successful – token stored in IndexedDB');

      return { token: data.access_token, user: data.user || null };
    } catch (err) {
      console.error('[Auth] Login error:', err);
      throw err;
    }
  }

  /**
   * Logs out the user by removing the token from storage.
   */
  async logout() {
    await deleteToken();
    console.log('[Auth] Logged out – token removed from IndexedDB');
  }
}

// Export a singleton instance
export const auth = new AuthLibrary();