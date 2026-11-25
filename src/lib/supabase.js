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

// Two separate sign-ins, each saved under its own storage key, so an admin (admin panel) and
// an employee (attendance page) can stay signed in at the same time in different tabs of one
// browser, and logging out of one doesn't log out the other.
const makeClient = (storageKey) =>
  createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: AsyncStorage,
      storageKey,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

const clients = {
  admin: makeClient('ineos-admin-auth'),
  employee: makeClient('ineos-employee-auth'),
};

// A short-lived client that remembers nothing; used to check a login before deciding which
// of the two sign-ins it belongs to.
export const makeTemporaryClient = () =>
  createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

// Which sign-in the current screen uses: admin pages (/admin…, /admin-login) use the admin
// one, everything else the employee one. On the web this comes from the address bar; native
// apps (one role per app session) fall back to what the layouts set.
let nativeMode = 'employee';
export function setMode(mode) {
  nativeMode = mode;
}
export function getMode() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.pathname.startsWith('/admin') ? 'admin' : 'employee';
  }
  return nativeMode;
}

export const clientFor = (mode) => clients[mode];

// The Supabase client for the current screen.
export const db = () => clients[getMode()];

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
