import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  initKeycloak,
  loginKeycloak,
  logoutKeycloak,
  getUserProfile,
  persistTokens,
  clearStoredTokens,
  keycloak,
  UserProfile,
} from './keycloak';

interface AuthContextType {
  isAuthenticated: boolean;
  isInitialized: boolean;
  user: UserProfile | null;
  login: (redirectUri?: string) => void;
  logout: () => void;
  token?: string;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isInitialized: false,
  user: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    initKeycloak().then((authenticated) => {
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setUser(getUserProfile());
      }
      setIsInitialized(true);
    });

    keycloak.onAuthSuccess = () => {
      persistTokens();
      setIsAuthenticated(true);
      setUser(getUserProfile());
    };

    keycloak.onAuthRefreshSuccess = () => {
      persistTokens();
      setIsAuthenticated(true);
      setUser(getUserProfile());
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
            persistTokens();
            setIsAuthenticated(true);
            setUser(getUserProfile());
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
      if (keycloak.authenticated) {
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
    loginKeycloak(redirectUri);
  };

  const logout = () => {
    clearStoredTokens();
    logoutKeycloak();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isInitialized,
        user,
        login,
        logout,
        token: keycloak.token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
