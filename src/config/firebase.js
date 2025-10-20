import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const getEnvVar = (name) => {
  if (typeof process !== 'undefined' && process.env?.[name]) {
    const val = process.env[name];
    return typeof val === 'string' ? val.trim() : val;
  }
  try {
    const extra = Constants?.expoConfig?.extra ?? Constants?.manifest?.extra;
    if (extra?.[name]) {
      const val = extra[name];
      return typeof val === 'string' ? val.trim() : val;
    }
  } catch {}
  return undefined;
};

const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase configuration missing. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

let supabaseClient = null;

const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is missing.');
  }
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storage: AsyncStorage,
        autoRefreshToken: true,
      },
    });
    console.log('✅ Supabase client initialized');
  }
  return supabaseClient;
};

export const getSupabaseClient = () => createSupabaseClient();

export default {
  getSupabaseClient,
};