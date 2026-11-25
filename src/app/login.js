import LoginScreen from '../components/LoginScreen';
import { setMode } from '../lib/supabase';

// /login — employee sign-in (admins who sign in here are sent to the admin panel).
export default function EmployeeLogin() {
  setMode('employee'); // native apps: use the employee sign-in from here on
  return <LoginScreen mode="employee" />;
}
