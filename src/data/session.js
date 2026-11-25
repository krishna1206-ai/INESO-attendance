import { useEffect, useState } from 'react';
import { supabase, errorMessage } from '../lib/supabase';
import { invalidateAll, resetRealtime, useRemote } from './remote';
import { PROFILE_COLUMNS, mapProfile, normaliseEmail } from './employees';

// Sign-in for admins and employees, through Supabase Auth (email + password).
// The account's role ('admin' | 'employee') comes from the `profiles` table.

let userId; // undefined = not checked yet, null = signed out
let ready = null;
const listeners = new Set();
const setUser = (id) => {
  if (id === userId) return;
  const changed = userId !== undefined;
  userId = id;
  if (changed) {
    // A different person: drop cached data and reconnect live updates with their permissions.
    invalidateAll();
    resetRealtime();
  }
  listeners.forEach((fn) => fn(userId));
};

function ensureStarted() {
  if (!ready) {
    ready = supabase.auth.getSession().then(({ data }) => setUser(data.session?.user?.id ?? null));
    supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user?.id ?? null));
  }
  return ready;
}

// Resolves to { role } on success or { error } with a message for the login form.
export async function signIn(email, password) {
  const mail = normaliseEmail(email);
  if (!mail || !password) return { error: 'Please enter your email and password.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password });
  if (error) {
    return {
      error: /invalid login credentials/i.test(error.message)
        ? 'Incorrect email or password.'
        : errorMessage(error),
    };
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    await supabase.auth.signOut();
    return { error: 'This account is not set up yet. Please contact your admin.' };
  }
  setUser(data.user.id);
  return { role: profile.role };
}

export async function signOut() {
  await supabase.auth.signOut();
  setUser(null);
}

// { employee, role, loading }. `employee` is the signed-in account's profile
// ({ id, name, email, role, departmentId, subDepartmentId }) or null when signed out.
export function useSession() {
  const [id, setId] = useState(userId);

  useEffect(() => {
    listeners.add(setId);
    if (userId !== undefined) setId(userId);
    else ensureStarted();
    return () => listeners.delete(setId);
  }, []);

  const { data: profile, loading: profileLoading } = useRemote(
    id ? `profile:${id}` : null,
    async () => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapProfile(data) : null;
    },
    ['profiles']
  );

  const loading = id === undefined || (Boolean(id) && profileLoading);
  const employee = id && profile ? profile : null;
  return { employee, role: employee?.role ?? null, loading };
}
