import { useEffect, useReducer } from 'react';
import { clientFor, getMode } from '../lib/supabase';

// A tiny shared cache for Supabase reads.
//  * Each query has a key (e.g. 'attendance:date:2026-11-25') and a fetcher.
//  * Screens using the same key share one request and one result.
//  * When a table changes (our own writes, or anyone else's via Supabase Realtime), every
//    query that reads that table is fetched again, so all screens stay up to date.
//  * Admin and employee sign-ins are kept apart (see lib/supabase.js), so every query and
//    live-update channel belongs to one mode ('admin' | 'employee').

const queries = new Map(); // `${mode}|${key}` -> { mode, data, error, loaded, stale, inflight, fetcher, tables, listeners }

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

// After sign-in / sign-out of one mode, every result of that mode may differ.
export function invalidateAll(mode) {
  for (const q of queries.values()) {
    if (q.mode !== mode) continue;
    q.data = undefined;
    q.loaded = false;
    if (q.listeners.size > 0) run(q);
    else q.stale = true;
  }
}

// Realtime: one channel per mode and table, opened on first use.
const channels = new Map(); // `${mode}|${table}` -> channel
let pending = new Set();
let timer = null;
function watch(mode, table) {
  const id = `${mode}|${table}`;
  if (channels.has(id)) return;
  const client = clientFor(mode);
  const channel = client
    .channel(`table-${mode}-${table}`)
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
  channels.set(id, channel);
}

// Realtime only delivers rows the signed-in user may read, so reconnect that mode's channels
// after its sign-in changes.
export function resetRealtime(mode) {
  const client = clientFor(mode);
  for (const [id, ch] of channels) {
    if (id.startsWith(`${mode}|`)) {
      client.removeChannel(ch);
      channels.delete(id);
    }
  }
  for (const q of queries.values()) {
    if (q.mode === mode && q.listeners.size > 0) q.tables.forEach((t) => watch(mode, t));
  }
}

// { data, loading, error } for a query. Pass key = null to skip (e.g. no user yet).
export function useRemote(key, fetcher, tables) {
  const [, force] = useReducer((x) => x + 1, 0);
  const mode = getMode();
  const fullKey = key ? `${mode}|${key}` : null;

  useEffect(() => {
    if (!fullKey) return undefined;
    let q = queries.get(fullKey);
    if (!q) {
      q = { key: fullKey, mode, data: undefined, error: null, loaded: false, stale: false, inflight: null, listeners: new Set() };
      queries.set(fullKey, q);
    }
    q.fetcher = fetcher;
    q.tables = tables;
    q.listeners.add(force);
    tables.forEach((t) => watch(mode, t));
    if (!q.loaded || q.stale) {
      q.stale = false;
      run(q);
    }
    return () => q.listeners.delete(force);
    // fetcher/tables are derived from the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const q = fullKey ? queries.get(fullKey) : null;
  return { data: q?.data, loading: Boolean(fullKey) && !q?.loaded, error: q?.error ?? null };
}
