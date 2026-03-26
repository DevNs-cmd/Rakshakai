'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/lib/types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('rakshak_token');
    const savedUser = localStorage.getItem('rakshak_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Forced mock login bypass: automatically sign in as the seeded admin user
    // regardless of what the user inputs in the login form.
    try {
       const data = await api.login('admin@rakshak.gov.in', 'Admin@123');
       localStorage.setItem('rakshak_token', data.access_token);
       localStorage.setItem('rakshak_user', JSON.stringify(data.user));
       setToken(data.access_token);
       setUser(data.user);
    } catch(err) {
       console.error("Auto-login failed:", err);
       throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('rakshak_token');
    localStorage.removeItem('rakshak_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

