import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user") || sessionStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (!user) return;
    const serializedUser = JSON.stringify(user);
    if (localStorage.getItem("user")) localStorage.setItem("user", serializedUser);
    if (sessionStorage.getItem("user")) sessionStorage.setItem("user", serializedUser);
  }, [user]);

  const updateAvatar = (newAvatarUrl) => {
    setUser((prev) => ({ ...prev, profile_picture: newAvatarUrl }));
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates};
      if (localStorage.getItem('user'))localStorage.setItem('user', JSON.stringify(updated));
      if (sessionStorage.getItem('user'))sessionStorage.setItem('user', JSON.stringify(updated));
      return updated;
    })
  };

  return (
    <AuthContext.Provider value={{ user, setUser, updateAvatar, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
