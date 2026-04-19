'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { User } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: { username?: string; avatar_url?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    const initSupabase = async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const client = createClient(supabaseUrl, supabaseKey);
        setSupabase(client);

        const { data: { session } } = await client.auth.getSession();
        setSession(session);
        
        if (session?.user) {
          await fetchUserProfile(client, session.user.id);
        }
        setLoading(false);

        client.auth.onAuthStateChange(async (event, session) => {
          setSession(session);
          if (session?.user) {
            await fetchUserProfile(client, session.user.id);
          } else {
            setUser(null);
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    };

    initSupabase();
  }, []);

  const fetchUserProfile = async (client: any, userId: string) => {
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setUser(data);
    } else {
      const { data: authUser } = await client.auth.getUser();
      if (authUser?.user) {
        const newUser = {
          id: authUser.user.id,
          email: authUser.user.email || '',
          username: authUser.user.user_metadata?.username || 'User',
          avatar_url: null,
          is_online: true,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        
        await client.from('users').insert(newUser);
        setUser(newUser);
      }
    }
  };

  const login = async (email: string, password: string) => {
    if (!supabase) throw new Error('Not initialized');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const register = async (email: string, username: string, password: string) => {
    if (!supabase) throw new Error('Not initialized');
    
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { username }
      }
    });
    
    if (error) throw error;
    
    if (data.user) {
      const newUser = {
        id: data.user.id,
        email,
        username,
        avatar_url: null,
        is_online: true,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      
      await supabase.from('users').insert(newUser);
    }
  };

  const logout = async () => {
    if (!supabase) return;
    if (user) {
      await supabase
        .from('users')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    }
    await supabase.auth.signOut();
  };

  const updateUser = async (updates: { username?: string; avatar_url?: string }) => {
    if (!supabase || !user) throw new Error('Not authenticated');
    
    await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    setUser((prev) => prev ? { ...prev, ...updates } : null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
