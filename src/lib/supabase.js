import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// React Native's built-in URL is incomplete; browsers already have a full one.
if (Platform.OS !== 'web') {
  require('react-native-url-polyfill/auto');
}

// Project URL and *publishable* key. These are meant to be public: they ship inside the app,
// and the data is protected by Row Level Security (see supabase/schema.sql).
// Never put the secret / service_role key here.
export const SUPABASE_URL = 'https://hgcxpifixoaiucppqjdr.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_44_6_6lejkDJ2QXj32_D5w_MF_39VS-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Turns a Supabase error into a message for the user. Errors raised by our database
// functions already carry a readable message.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return null;
  if (error.code === '23505') return 'That name is already used.';
  if (/Failed to fetch|NetworkError|Network request failed/i.test(error.message ?? '')) {
    return 'No internet connection. Please check your network and try again.';
  }
  return error.message || fallback;
}
