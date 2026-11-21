import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticate, useEmployees } from './employees';

// Which employee is signed in on this device. Only the employee id is kept.
// NOTE: this is a device-local login for the prototype. Anyone with access to the browser's
// storage can change it; real sign-in needs a backend issuing sessions/tokens.
const SESSION_KEY = 'ineos.session.v1';

let current; // undefined = not loaded yet, null = signed out, string = employee id
let loadPromise = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(current));

function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(SESSION_KEY)
      .then((raw) => (raw ? JSON.parse(raw).employeeId ?? null : null))
      .catch(() => null)
      .then((id) => {
        current = id;
        notify();
      });
  }
  return loadPromise;
}

async function setSession(employeeId) {
  current = employeeId;
  notify();
  try {
    if (employeeId) {
      await AsyncStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ employeeId, signedInAt: new Date().toISOString() })
      );
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage unavailable: the session still works until the page reloads.
  }
}

// Returns an error message, or null when signed in.
export async function signIn(email, password) {
  const { employee, error } = await authenticate(email, password);
  if (error) return error;
  await setSession(employee.id);
  return null;
}

export const signOut = () => setSession(null);

// { employee, loading }. employee is null when signed out, or when the signed-in
// employee was deleted by the admin (then the stale session is cleared).
export function useSession() {
  const [employeeId, setEmployeeId] = useState(current);
  const { employees, loading: employeesLoading } = useEmployees();

  useEffect(() => {
    const listener = (id) => setEmployeeId(id);
    listeners.add(listener);
    if (current !== undefined) listener(current);
    else ensureLoaded();
    return () => listeners.delete(listener);
  }, []);

  const loading = employeeId === undefined || employeesLoading;
  const employee = employeeId ? employees.find((e) => e.id === employeeId) ?? null : null;

  useEffect(() => {
    if (!loading && employeeId && !employee) setSession(null);
  }, [loading, employeeId, employee]);

  return { employee, loading };
}
