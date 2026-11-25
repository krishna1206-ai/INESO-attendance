import { useEffect, useState } from 'react';
import { clientFor, errorMessage, getMode, makeTemporaryClient } from '../lib/supabase';
import { invalidateAll, resetRealtime, useRemote } from './remote';
import { PROFILE_COLUMNS, mapProfile, normaliseEmail } from './employees';

// Sign-in for admins and employees, through Supabase Auth (email + password).
// Admin and employee sign-ins are separate (see lib/supabase.js): the admin panel uses one,
// the attendance pages the other, so both can be open at once in different tabs.
// The account's role ('admin' | 'employee') comes from the `profiles` table.

const state = {
  admin: { userId: undefined, started: false, listeners: new Set() },
  employee: { userId: undefined, started: false, listeners: new Set() },
};

function setUser(mode, id) {
  const s = state[mode];
  if (id === s.userId) return;
  const changed = s.userId !== undefined;
  s.userId = id;
  if (changed) {
    // A different person: drop this mode's cached data and reconnect its live updates.
    invalidateAll(mode);
    resetRealtime(mode);
  }
  s.listeners.forEach((fn) => fn(id));
}

function ensureStarted(mode) {
  const s = state[mode];
  if (s.started) return;
  s.started = true;
  const client = clientFor(mode);
  client.auth.getSession().then(({ data }) => setUser(mode, data.session?.user?.id ?? null));
  client.auth.onAuthStateChange((_event, session) => setUser(mode, session?.user?.id ?? null));
}

// Signs in on the admin or employee side.
//  mode 'admin'    — only admin accounts are accepted.
//  mode 'employee' — employee accounts; an admin account is signed in on the admin side instead.
// Resolves to { role } on success or { error } with a message for the login form.
export async function signIn(email, password, mode = 'employee') {
  const mail = normaliseEmail(email);
  if (!mail || !password) return { error: 'Please enter your email and password.' };

  // Check the login with a throwaway client first, then hand the session to the right side.
  const temp = makeTemporaryClient();
  const { data, error } = await temp.auth.signInWithPassword({ email: mail, password });
  if (error) {
    return {
      error: /invalid login credentials/i.test(error.message)
        ? 'Incorrect email or password.'
        : errorMessage(error),
    };
  }
  const { data: profile, error: profileError } = await temp
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: 'This account is not set up yet. Please contact your admin.' };
  }
  if (mode === 'admin' && profile.role !== 'admin') {
    return { error: 'This is not an admin account. Employees sign in on the attendance page.' };
  }

  const target = profile.role === 'admin' ? 'admin' : 'employee';
  const { error: sessionError } = await clientFor(target).auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) return { error: errorMessage(sessionError) };
  ensureStarted(target);
  setUser(target, data.user.id);
  return { role: profile.role };
}

// Signs out only this side (admin or employee) in this browser; the other side stays signed in.
export async function signOut(mode = getMode()) {
  await clientFor(mode).auth.signOut({ scope: 'local' });
  setUser(mode, null);
}

// { employee, role, loading } for the current side (admin pages → admin sign-in, other pages →
// employee sign-in). `employee` is the signed-in account's profile
// ({ id, name, email, role, departmentId, subDepartmentId }) or null when signed out.
export function useSession() {
  const mode = getMode();
  const [id, setId] = useState(state[mode].userId);

  useEffect(() => {
    const s = state[mode];
    s.listeners.add(setId);
    setId(s.userId);
    ensureStarted(mode);
    return () => s.listeners.delete(setId);
  }, [mode]);

  const { data: profile, loading: profileLoading } = useRemote(
    id ? `profile:${id}` : null,
    async () => {
      const { data, error } = await clientFor(mode)
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProfile(data) : null;
    },
    ['profiles']
  );

  const loading = id === undefined || (Boolean(id) && profileLoading);
  const employee = id && profile ? profile : null;
  return { employee, role: employee?.role ?? null, loading };
}
