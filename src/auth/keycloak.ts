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
  realmRoles?: string[];
  isAdmin?: boolean;
  isTeacher?: boolean;
  activeRoleBadge?: string;
}

export const ALLOWED_REALM_ROLES = ['ADMIN', 'TEACHER'] as const;

/**
 * Validates if the user's Keycloak token possesses the required ADMIN or TEACHER Realm role.
 */
export function hasRequiredRealmRole(tokenParsed: any): boolean {
  if (!tokenParsed) return false;
  const realmRoles: string[] = tokenParsed.realm_access?.roles || [];
  return realmRoles.some((role) => {
    const upper = String(role).trim().toUpperCase();
    return upper === 'ADMIN' || upper === 'TEACHER';
  });
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
 * - Enforces ADMIN and TEACHER Realm roles!
 * - Does NOT redirect guest / mobile visitors!
 * - Persists session across page refreshes and browser tabs!
 */
export async function initKeycloak(): Promise<boolean> {
  if (isInitialized) {
    return (keycloak.authenticated && hasRequiredRealmRole(keycloak.tokenParsed)) || false;
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
      if (hasRequiredRealmRole(keycloak.tokenParsed)) {
        persistTokens();
        isInitialized = true;
        return true;
      } else {
        console.warn('[Keycloak] Bejelentkezés elutasítva: A felhasználó nem rendelkezik ADMIN vagy TEACHER Realm role-lal.');
        clearStoredTokens();
        isInitialized = true;
        return false;
      }
    } else if (!isOAuthCallback && savedRefreshToken) {
      // Try refreshing with stored refresh token
      try {
        const refreshed = await keycloak.updateToken(70);
        if ((refreshed || keycloak.authenticated) && hasRequiredRealmRole(keycloak.tokenParsed)) {
          persistTokens();
          isInitialized = true;
          return true;
        } else {
          clearStoredTokens();
        }
      } catch {
        clearStoredTokens();
      }
    }

    isInitialized = true;
    return false;
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
 * Extract User Profile Info only if having required ADMIN or TEACHER Realm role
 */
export function getUserProfile(): UserProfile | null {
  if (!keycloak.authenticated || !keycloak.tokenParsed) {
    return null;
  }

  const parsed = keycloak.tokenParsed as any;
  const realmRoles: string[] = parsed.realm_access?.roles || [];
  const resourceRoles: string[] = parsed.resource_access?.[keycloakConfig.clientId]?.roles || [];
  const allRoles = [...realmRoles, ...resourceRoles];

  if (!hasRequiredRealmRole(parsed)) {
    return null;
  }

  const upperRealmRoles = realmRoles.map((r) => String(r).trim().toUpperCase());
  const isAdmin = upperRealmRoles.includes('ADMIN');
  const isTeacher = upperRealmRoles.includes('TEACHER');
  const activeRoleBadge = isAdmin ? 'ADMIN' : isTeacher ? 'TEACHER' : undefined;

  return {
    id: parsed.sub,
    username: parsed.preferred_username || parsed.name || 'Felhasználó',
    name: parsed.name || parsed.preferred_username || 'Pollák Felhasználó',
    email: parsed.email,
    roles: allRoles,
    realmRoles,
    isAdmin,
    isTeacher,
    activeRoleBadge,
  };
}
