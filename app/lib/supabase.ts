import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}

export { getSupabaseClient as supabase };

export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  created_at: string;
  edited?: boolean;
  sender?: User;
}

export interface Conversation {
  id: string;
  participants: string[];
  created_at: string;
  last_message?: Message;
  last_message_at: string | null;
  user_data?: User;
}
