import Keycloak from 'keycloak-js';

// Configuration from environment variables with fallback defaults
export const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'https://keycloak.pollak.info',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'master',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'find',
};

// Create Keycloak instance
export const keycloak = new Keycloak(keycloakConfig);

export interface UserProfile {
  id?: string;
  username?: string;
  name?: string;
  email?: string;
  roles?: string[];
  isAdmin?: boolean;
}

const STORAGE_KEY_TOKEN = 'pollak_find_kc_token';
const STORAGE_KEY_REFRESH = 'pollak_find_kc_refresh_token';
const STORAGE_KEY_ID_TOKEN = 'pollak_find_kc_id_token';

let isInitialized = false;

/**
 * Save tokens to localStorage
 */
export function persistTokens() {
  if (typeof window === 'undefined') return;
  if (keycloak.token) {
    localStorage.setItem(STORAGE_KEY_TOKEN, keycloak.token);
  }
  if (keycloak.refreshToken) {
    localStorage.setItem(STORAGE_KEY_REFRESH, keycloak.refreshToken);
  }
  if (keycloak.idToken) {
    localStorage.setItem(STORAGE_KEY_ID_TOKEN, keycloak.idToken);
  }
}

/**
 * Clear stored tokens from localStorage
 */
export function clearStoredTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_REFRESH);
  localStorage.removeItem(STORAGE_KEY_ID_TOKEN);
}

/**
 * Initializes Keycloak with token persistence & PKCE.
 * - Does NOT redirect guest / mobile visitors!
 * - Persists session across page refreshes and browser tabs!
 */
export async function initKeycloak(): Promise<boolean> {
  if (isInitialized) {
    return keycloak.authenticated || false;
  }

  const savedToken = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_TOKEN) : null;
  const savedRefreshToken = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_REFRESH) : null;
  const savedIdToken = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ID_TOKEN) : null;

  try {
    const isOAuthCallback =
      window.location.search.includes('code=') ||
      window.location.search.includes('state=') ||
      window.location.hash.includes('access_token');

    const authenticated = await keycloak.init({
      onLoad: isOAuthCallback ? 'check-sso' : undefined,
      token: savedToken || undefined,
      refreshToken: savedRefreshToken || undefined,
      idToken: savedIdToken || undefined,
      pkceMethod: 'S256',
      checkLoginIframe: false,
      enableLogging: false,
    });

    if (authenticated) {
      persistTokens();
    } else if (!isOAuthCallback && savedRefreshToken) {
      // Try refreshing with stored refresh token
      try {
        const refreshed = await keycloak.updateToken(70);
        if (refreshed || keycloak.authenticated) {
          persistTokens();
          isInitialized = true;
          return true;
        }
      } catch {
        clearStoredTokens();
      }
    }

    isInitialized = true;
    return authenticated || false;
  } catch (error) {
    console.warn('[Keycloak] Inicializációs figyelmeztetés:', error);
    clearStoredTokens();
    isInitialized = true;
    return false;
  }
}

/**
 * Trigger Login via Pollák Keycloak SSO (explicit user action only)
 */
export function loginKeycloak(redirectUri?: string): Promise<void> {
  return keycloak.login({
    redirectUri: redirectUri || window.location.href,
  });
}

/**
 * Trigger Logout
 */
export function logoutKeycloak(): Promise<void> {
  clearStoredTokens();
  return keycloak.logout({
    redirectUri: window.location.origin,
  });
}

/**
 * Extract User Profile Info
 */
export function getUserProfile(): UserProfile | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    return null;
  }

  const parsed = keycloak.tokenParsed as any;
  const realmRoles = parsed.realm_access?.roles || [];
  const resourceRoles = parsed.resource_access?.[keycloakConfig.clientId]?.roles || [];
  const allRoles = [...realmRoles, ...resourceRoles];

  return {
    id: parsed.sub,
    username: parsed.preferred_username || parsed.name || 'Felhasználó',
    name: parsed.name || parsed.preferred_username || 'Pollák Felhasználó',
    email: parsed.email,
    roles: allRoles,
    isAdmin: allRoles.includes('admin') || allRoles.includes('editor') || allRoles.includes('realm-admin'),
  };
}
