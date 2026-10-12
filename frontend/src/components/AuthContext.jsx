import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Determine which storage holds the active session token,
    // then read the user from the same storage.
    const storage = sessionStorage.getItem("token")
      ? sessionStorage
      : localStorage.getItem("token")
      ? localStorage
      : null;
    const stored = storage ? storage.getItem("user") : null;
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (!user) return;
    const serializedUser = JSON.stringify(user);
    if (localStorage.getItem("user")) localStorage.setItem("user", serializedUser);
    if (sessionStorage.getItem("user")) sessionStorage.setItem("user", serializedUser);
  }, [user]);

  const updateAvatar = (newAvatarUrl) => {
    setUser((prev) => {
      const updated = { ...prev, profile_picture: newAvatarUrl };
      if (localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(updated));
      if (sessionStorage.getItem('user')) sessionStorage.setItem('user', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('user:updated'));
      return updated;
    });
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...updates };
      if (!merged.full_name && (merged.first_name || merged.last_name)) {
        merged.full_name = `${merged.first_name || ''} ${merged.last_name || ''}`.trim() || merged.username;
      }
      const serialized = JSON.stringify(merged);
      if (sessionStorage.getItem('token') || sessionStorage.getItem('user')) {
        sessionStorage.setItem('user', serialized);
      }
      if (localStorage.getItem('token') || localStorage.getItem('user')) {
        localStorage.setItem('user', serialized);
      }
      if (!sessionStorage.getItem('token') && !localStorage.getItem('token')) {
        localStorage.setItem('user', serialized);
      }
      window.dispatchEvent(new CustomEvent('user:updated'));
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, setUser, updateAvatar, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
