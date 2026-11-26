import { db, errorMessage } from '../lib/supabase';

// Password rules for employee accounts. The passwords themselves are stored and checked by
// Supabase Auth (bcrypt), never by the app.

export const MIN_PASSWORD_LENGTH = 6;

export function checkPasswordRules(password) {
  if (!password) return 'Please enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(password)) return 'Password cannot start or end with a space.';
  return null;
}

// The signed-in user (admin or employee, whichever side this page is) changes their own
// password. The server checks the current password first. Returns an error message or null.
export async function changeMyPassword(current, next, confirm) {
  if (!current) return 'Please enter your current password.';
  const rule = checkPasswordRules(next);
  if (rule) return rule;
  if (next !== confirm) return "The new passwords don't match.";
  if (next === current) return 'New password must be different from the current one.';
  const { error } = await db().rpc('change_my_password', { p_current: current, p_new: next });
  return error ? errorMessage(error) : null;
}
