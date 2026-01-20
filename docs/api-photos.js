// api-photos.js
import { getPhotosBaseUrl, getDefaultPageSize } from './config.js';

let currentToken = null;

/**
 * Expose function to set the token (called by app.js)
 */
export function setAuthToken(token) {
  currentToken = token;
}

/**
 * Internal helper to handle authenticated fetch requests
 */
async function apiFetch(path, options = {}) {
  const baseUrl = await getPhotosBaseUrl();
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');

  // Handle Search Params
  if (options.searchParams) {
    Object.keys(options.searchParams).forEach(key => 
      url.searchParams.append(key, options.searchParams[key])
    );
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    console.warn('[Photos API] Session expired');
    currentToken = null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

export async function getPhotos(page = 1, limit = null) {
  const actualLimit = limit ?? (await getDefaultPageSize());
  return apiFetch('photos', {
    searchParams: { page, limit: actualLimit }
  });
}

export async function getPhotoById(id) {
  return apiFetch(`photo/${id}`);
}