import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getMe, loginWithDevToken, loginWithUniqueId } from "../api/auth";
import { ApiError, getStoredToken, registerAuthFailureHandler, setStoredToken } from "../api/client";
import type { MeOut, Role } from "../types/api";

interface AuthContextType {
  user: MeOut | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (uniqueId: string, password: string) => Promise<void>;
  devLogin: (username: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: Role | Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MeOut | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const meData = await getMe();
      setUser(meData);
    } catch (err: any) {
      setUser(null);
      setStoredToken(null);
      setToken(null);
      setError(err.message || "Session expired or invalid");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    registerAuthFailureHandler(() => {
      logout();
    });

    if (token) {
      refreshMe();
    } else {
      setIsLoading(false);
    }
  }, [token, refreshMe, logout]);

  const login = async (uniqueId: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await loginWithUniqueId(uniqueId, password);
      setStoredToken(response.access_token);
      setToken(response.access_token);
      try {
        const meData = await getMe();
        setUser(meData);
      } catch (meErr: any) {
        throw new ApiError(meErr.status || 500, "Failed to load user profile", { code: "session_error" });
      }
    } catch (err: any) {
      const msg = err.message || "Invalid Unique ID or Access Revoked";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const devLogin = async (username: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await loginWithDevToken(username);
      setStoredToken(response.access_token);
      setToken(response.access_token);
      const meData = await getMe();
      setUser(meData);
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  const hasRole = (roles: Role | Role[]): boolean => {
    if (!user) return false;
    const allowed = Array.isArray(roles) ? roles : [roles];
    return allowed.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        devLogin,
        logout,
        refreshMe,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
