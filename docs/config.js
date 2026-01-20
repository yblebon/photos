/**
 * ConfigLibrary
 * A single responsible module for loading and accessing application configuration.
 */
class ConfigLibrary {
  constructor() {
    this.cachedConfig = null;
    this.isLoading = false;
  }

  /**
   * Internal method to fetch and parse config.json
   */
  async _loadConfig() {
    if (this.cachedConfig) return this.cachedConfig;
    
    if (this.isLoading) {
      // Prevent concurrent fetches (simple promise sharing)
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (this.cachedConfig) {
            clearInterval(interval);
            resolve(this.cachedConfig);
          }
        }, 50);
      });
    }

    this.isLoading = true;

    try {
      const response = await fetch('/config.json', {
        cache: 'no-cache',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to load config.json: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Basic validation
      if (!data.photosApiBaseUrl || typeof data.photosApiBaseUrl !== 'string') {
        throw new Error('config.json is missing valid "photosApiBaseUrl"');
      }
      if (!data.authApiBaseUrl || typeof data.authApiBaseUrl !== 'string') {
        throw new Error('config.json is missing valid "authApiBaseUrl"');
      }

      this.cachedConfig = {
        photosApiBaseUrl: data.photosApiBaseUrl.replace(/\/+$/, ''),
        authApiBaseUrl:   data.authApiBaseUrl.replace(/\/+$/, ''),
        appName:          data.appName || 'Photo Vault',
        debug:            !!data.debug,
        defaultPageSize:  Number(data.defaultPageSize) || 12
      };

      console.log('[Config] Loaded successfully:', this.cachedConfig);
      return this.cachedConfig;
    } catch (err) {
      console.error('[Config] Load failed:', err);

      // Minimal fallback – enough to not crash the app completely
      this.cachedConfig = {
        photosApiBaseUrl: 'https://your-photos-app.vercel.app/api',
        authApiBaseUrl:   'https://your-auth-app.vercel.app/api',
        appName:          'Photo Vault (fallback)',
        debug:            false,
        defaultPageSize:  12
      };

      console.warn('[Config] Using fallback configuration');
      return this.cachedConfig;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get the entire config (loads if necessary)
   */
  async getConfig() {
    return this._loadConfig();
  }

  /**
   * Convenience getters (lazy load)
   */
  async getPhotosBaseUrl() {
    const cfg = await this._loadConfig();
    return cfg.photosApiBaseUrl;
  }

  async getAuthBaseUrl() {
    const cfg = await this._loadConfig();
    return cfg.authApiBaseUrl;
  }

  async getDefaultPageSize() {
    const cfg = await this._loadConfig();
    return cfg.defaultPageSize;
  }

  /**
   * For debugging or manual override
   */
  resetConfigCache() {
    this.cachedConfig = null;
    console.log('[Config] Cache reset');
  }
}

// Export a singleton instance for app-wide use
export const config = new ConfigLibrary();

// Export named methods to maintain backward compatibility with your previous imports
export const getConfig = () => config.getConfig();
export const getPhotosBaseUrl = () => config.getPhotosBaseUrl();
export const getAuthBaseUrl = () => config.getAuthBaseUrl();
export const getDefaultPageSize = () => config.getDefaultPageSize();
export const resetConfigCache = () => config.resetConfigCache();