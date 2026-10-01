import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      if (!authApi.hasToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user: profile } = await authApi.profile();
        setUser(profile);
        localStorage.setItem("mm_user", JSON.stringify(profile));
      } catch {
        authApi.clearToken();
        localStorage.removeItem("mm_user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("mm-auth-expired", expire);
    return () => window.removeEventListener("mm-auth-expired", expire);
  }, []);

  const login = (session) => {
    authApi.storeToken(session.access_token);
    setUser(session.user);
    try {
      localStorage.setItem("mm_user", JSON.stringify(session.user));
    } catch {
      // Session still active in component memory
    }
  };

  const logout = async () => {
    try {
      if (authApi.hasToken()) await authApi.logout();
    } catch {
      // Ignore network errors on logout - token will be cleared locally
    }
    setUser(null);
    authApi.clearToken();
    localStorage.removeItem("mm_user");
    Object.keys(sessionStorage).filter((key) => key.startsWith("mm_interview_")).forEach((key) => sessionStorage.removeItem(key));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
