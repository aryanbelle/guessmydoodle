import React, { createContext, useContext, useMemo, useState } from "react";
import { backendUrl } from "./backendUrl";

const AuthContext = createContext(null);
const USER_STORAGE_KEY = "guestUser";

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || null; }
    catch (_) { return null; }
  });

  const value = useMemo(() => ({
    currentUser,
    signIn: async (nickname) => {
      const response = await fetch(`${backendUrl}/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.user || !result.token) throw new Error(result.message || "Could not sign in right now. Please try again.");
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
      localStorage.setItem("authToken", result.token);
      setCurrentUser(result.user);
      return result.user;
    },
    signOut: () => {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem("authToken");
      localStorage.removeItem("nickname");
      setCurrentUser(null);
    },
  }), [currentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
