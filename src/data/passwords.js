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
