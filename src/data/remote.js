import { useEffect, useReducer } from 'react';
import { supabase } from '../lib/supabase';

// A tiny shared cache for Supabase reads.
//  * Each query has a key (e.g. 'attendance:date:2026-11-25') and a fetcher.
//  * Screens using the same key share one request and one result.
//  * When a table changes (our own writes, or anyone else's via Supabase Realtime), every
//    query that reads that table is fetched again, so all screens stay up to date.

const queries = new Map(); // key -> { data, error, loaded, stale, inflight, fetcher, tables, listeners }

function notify(q) {
  q.listeners.forEach((fn) => fn());
}

function run(q) {
  if (q.inflight) {
    q.again = true; // a change arrived mid-request: fetch once more afterwards
    return;
  }
  q.inflight = q
    .fetcher()
    .then((data) => {
      q.data = data;
      q.error = null;
    })
    .catch((e) => {
      q.error = e?.message ?? String(e);
      console.warn('[data]', q.key, q.error);
    })
    .finally(() => {
      q.inflight = null;
      q.loaded = true;
      notify(q);
      if (q.again) {
        q.again = false;
        run(q);
      }
    });
}

// Re-fetch every query that reads any of these tables.
export function invalidate(...tables) {
  for (const q of queries.values()) {
    if (q.tables.some((t) => tables.includes(t))) {
      if (q.listeners.size > 0) run(q);
      else q.stale = true;
    }
  }
}

// After sign-in / sign-out every result may differ (different permissions).
export function invalidateAll() {
  for (const q of queries.values()) {
    q.data = undefined;
    q.loaded = false;
    if (q.listeners.size > 0) run(q);
    else q.stale = true;
  }
}

// Realtime: one channel per table, opened on first use.
const channels = new Map();
let pending = new Set();
let timer = null;
function watch(table) {
  if (channels.has(table)) return;
  const channel = supabase
    .channel(`table-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      // Batch bursts of changes into one refresh.
      pending.add(table);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const tables = [...pending];
        pending = new Set();
        invalidate(...tables);
      }, 300);
    })
    .subscribe();
  channels.set(table, channel);
}

// Realtime only delivers rows the signed-in user may read, so reconnect channels after
// the session changes.
export function resetRealtime() {
  for (const ch of channels.values()) supabase.removeChannel(ch);
  channels.clear();
  const watched = new Set();
  for (const q of queries.values()) if (q.listeners.size > 0) q.tables.forEach((t) => watched.add(t));
  watched.forEach(watch);
}

// { data, loading, error } for a query. Pass key = null to skip (e.g. no user yet).
export function useRemote(key, fetcher, tables) {
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!key) return undefined;
    let q = queries.get(key);
    if (!q) {
      q = { key, data: undefined, error: null, loaded: false, stale: false, inflight: null, listeners: new Set() };
      queries.set(key, q);
    }
    q.fetcher = fetcher;
    q.tables = tables;
    q.listeners.add(force);
    tables.forEach(watch);
    if (!q.loaded || q.stale) {
      q.stale = false;
      run(q);
    }
    return () => q.listeners.delete(force);
    // fetcher/tables are derived from the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const q = key ? queries.get(key) : null;
  return { data: q?.data, loading: Boolean(key) && !q?.loaded, error: q?.error ?? null };
}
