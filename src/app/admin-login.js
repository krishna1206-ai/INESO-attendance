import LoginScreen from '../components/LoginScreen';
import { setMode } from '../lib/supabase';

// /admin-login — admin sign-in. Kept separate from the employee sign-in so an admin and an
// employee can stay signed in together in different tabs of the same browser.
export default function AdminLogin() {
  setMode('admin'); // native apps: use the admin sign-in from here on
  return <LoginScreen mode="admin" />;
}
