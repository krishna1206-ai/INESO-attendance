import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A list of records kept in device storage (AsyncStorage; localStorage on web) and shared
// in memory, so every screen sees the same data and updates together.
// Swap read/write for API calls once a backend exists.
export function createPersistentList(storageKey, normalise = (item) => item) {
  let cache = null; // null until first load
  let loadPromise = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(cache));

  async function read() {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(normalise) : [];
    } catch {
      return [];
    }
  }

  function ensureLoaded() {
    if (!loadPromise) {
      loadPromise = read().then((list) => {
        cache = list;
        notify();
      });
    }
    return loadPromise;
  }

  // Current list (loads it first if needed).
  async function get() {
    await ensureLoaded();
    return cache;
  }

  // Saves the whole list. Returns an error message, or null when saved.
  async function save(next) {
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      return 'Could not save. Storage may be full: try a smaller image or an image URL.';
    }
    cache = next;
    notify();
    return null;
  }

  // On web, pick up changes made in another tab without a reload.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === null || e.key === storageKey) {
        read().then((list) => {
          cache = list;
          notify();
        });
      }
    });
  }

  function useList() {
    const [items, setItems] = useState(cache ?? []);
    const [loading, setLoading] = useState(cache === null);
    useEffect(() => {
      const listener = (list) => {
        setItems(list ?? []);
        setLoading(false);
      };
      listeners.add(listener);
      if (cache !== null) listener(cache);
      else ensureLoaded();
      return () => listeners.delete(listener);
    }, []);
    return { items, loading };
  }

  return { get, save, useList };
}

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
