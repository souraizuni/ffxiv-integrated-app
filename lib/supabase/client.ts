import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types';

// 檢查 Supabase 環境變數是否已設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // 回傳一個模擬的 client，避免應用程式崩潰
    return null;
  }
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// 檢查 Supabase 是否已設定
export function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseAnonKey);
}
