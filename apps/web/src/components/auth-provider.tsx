'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

type User = { id: string; name: string; email: string; role: 'ADMIN' | 'BUYER'; department?: string; plant?: string };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      router.replace('/login');
    };
    window.addEventListener('corvo:unauthorized', onUnauthorized);
    return () => window.removeEventListener('corvo:unauthorized', onUnauthorized);
  }, [router]);

  useEffect(() => {
    async function initAuth() {
      const token = localStorage.getItem('corvo_token');
      if (!token) {
        setLoading(false);
        return;
      }
      api.setToken(token);
      try {
        // Retrieve and verify true user role and active status directly from backend
        const res = await api.getMe();
        if (res && res.user) {
          setUser(res.user);
          localStorage.setItem('corvo_user', JSON.stringify(res.user));
        } else {
          throw new Error('Invalid user response');
        }
      } catch {
        // Token invalid, expired, or user deactivated
        localStorage.removeItem('corvo_token');
        localStorage.removeItem('corvo_user');
        api.clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  useEffect(() => {
    if (loading) return;
    const publicPaths = ['/', '/login'];
    if (!publicPaths.includes(pathname) && !user) router.replace('/login');
  }, [loading, pathname, router, user]);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    localStorage.setItem('corvo_token', res.token);
    localStorage.setItem('corvo_user', JSON.stringify(res.user));
    api.setToken(res.token);
    setUser(res.user);
    return res.user;
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('corvo_token');
      localStorage.removeItem('corvo_user');
      api.clearToken();
      setUser(null);
      router.replace('/login');
    }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
