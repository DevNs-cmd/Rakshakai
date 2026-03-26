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
    // DEVELOPMENT/TESTING BYPASS: Grant access immediately
    const mockUser: User = {
      id: "test-user-id",
      email: email || "admin@rakshak.gov.in",
      full_name: "Test Administrator",
      role: "admin",
      is_active: true
    };
    const mockToken = "mock-jwt-token-for-rakshak-testing";

    localStorage.setItem('rakshak_token', mockToken);
    localStorage.setItem('rakshak_user', JSON.stringify(mockUser));
    setToken(mockToken);
    setUser(mockUser);
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

