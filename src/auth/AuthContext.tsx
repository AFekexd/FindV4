import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  initKeycloak,
  loginKeycloak,
  logoutKeycloak,
  getUserProfile,
  persistTokens,
  clearStoredTokens,
  hasRequiredRealmRole,
  keycloak,
  UserProfile,
} from './keycloak';

interface AuthContextType {
  isAuthenticated: boolean;
  isInitialized: boolean;
  user: UserProfile | null;
  authError: string | null;
  login: (redirectUri?: string) => void;
  logout: () => void;
  clearAuthError: () => void;
  token?: string;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isInitialized: false,
  user: null,
  authError: null,
  login: () => {},
  logout: () => {},
  clearAuthError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const validateAndSyncState = (authenticated: boolean) => {
    if (authenticated && keycloak.authenticated && keycloak.tokenParsed) {
      if (hasRequiredRealmRole(keycloak.tokenParsed)) {
        persistTokens();
        setIsAuthenticated(true);
        setUser(getUserProfile());
        setAuthError(null);
      } else {
        console.warn('[Keycloak] Hozzáférés megtagadva: Hiányzó ADMIN vagy TEACHER Realm role.');
        clearStoredTokens();
        setIsAuthenticated(false);
        setUser(null);
        setAuthError('Hozzáférés megtagadva: Csak ADMIN vagy TEACHER Realm jogosultsággal (role) rendelkező fiókok jelentkezhetnek be!');
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  useEffect(() => {
    initKeycloak().then((authenticated) => {
      validateAndSyncState(authenticated);
      setIsInitialized(true);
    });

    keycloak.onAuthSuccess = () => {
      validateAndSyncState(true);
    };

    keycloak.onAuthRefreshSuccess = () => {
      validateAndSyncState(true);
    };

    keycloak.onAuthLogout = () => {
      clearStoredTokens();
      setIsAuthenticated(false);
      setUser(null);
    };

    keycloak.onTokenExpired = () => {
      // Automatically refresh token before logging out
      keycloak
        .updateToken(60)
        .then((refreshed) => {
          if (refreshed) {
            validateAndSyncState(true);
          }
        })
        .catch(() => {
          clearStoredTokens();
          setIsAuthenticated(false);
          setUser(null);
        });
    };

    // Background silent token renewal check every 30 seconds
    const intervalId = setInterval(() => {
      if (keycloak.authenticated && hasRequiredRealmRole(keycloak.tokenParsed)) {
        keycloak
          .updateToken(60)
          .then((refreshed) => {
            if (refreshed) {
              persistTokens();
            }
          })
          .catch((err) => {
            console.warn('[Keycloak] Nem sikerült a token háttérbeli megújítása:', err);
          });
      }
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const login = (redirectUri?: string) => {
    setAuthError(null);
    loginKeycloak(redirectUri);
  };

  const logout = () => {
    setAuthError(null);
    clearStoredTokens();
    logoutKeycloak();
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isInitialized,
        user,
        authError,
        login,
        logout,
        clearAuthError,
        token: keycloak.token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
