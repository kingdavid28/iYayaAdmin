import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const getEnvVar = (name: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    const val = process.env[name];
    return typeof val === 'string' ? val.trim() : val;
  }
  try {
    const extra = (Constants as any)?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra;
    if (extra?.[name]) {
      const val = extra[name];
      return typeof val === 'string' ? val.trim() : val;
    }
  } catch (error) {
    console.warn('Supabase env lookup failed', error);
  }
  return undefined;
};

const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

console.log('[supabase] resolved URL:', supabaseUrl ?? 'undefined');
console.log('[supabase] resolved anon key:', supabaseAnonKey ?? 'undefined');

if (__DEV__) {
  console.log('[supabase] URL resolved:', supabaseUrl ?? 'undefined');
  console.log('[supabase] anon key present:', Boolean(supabaseAnonKey));
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase configuration missing. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    storage: AsyncStorage,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const getSupabaseClient = () => supabase;

export default supabase;
