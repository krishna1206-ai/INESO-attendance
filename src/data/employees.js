import { supabase, errorMessage } from '../lib/supabase';
import { invalidate, useRemote } from './remote';
import { checkPasswordRules } from './passwords';

// Employees are Supabase sign-in accounts with a row in `profiles` (role 'employee').
// Admins create, edit and delete them through database functions (admin_create_employee,
// admin_update_employee, admin_delete_employee in supabase/schema.sql), which also set the
// password. Passwords are stored by Supabase Auth, never by the app.
//
// Shape used by the screens: { id, name, email, departmentId, subDepartmentId, role, createdAt }
// subDepartmentId is '' when the department has no sub-departments.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normaliseEmail = (email) => (email ?? '').trim().toLowerCase();

export const PROFILE_COLUMNS = 'id, role, name, email, department_id, sub_department_id, created_at';

export function mapProfile(p) {
  return {
    id: p.id,
    role: p.role,
    name: p.name,
    email: p.email,
    departmentId: p.department_id ?? '',
    subDepartmentId: p.sub_department_id ?? '',
    createdAt: p.created_at,
  };
}

async function fetchEmployees() {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('role', 'employee')
    .order('name');
  if (error) throw error;
  return data.map(mapProfile);
}

// Quick checks in the app so the admin gets an answer before the request is sent.
// The database checks everything again.
function validate({ name, email, departmentId, subDepartmentId, password }, departments, editing) {
  const dept = departments.find((d) => d.id === departmentId);
  if (!dept) return 'Please select a department.';
  const subs = dept.subDepartments ?? [];
  if (subs.length > 0 && !subs.some((s) => s.id === subDepartmentId)) {
    return 'Please select a sub-department.';
  }
  if (!(name ?? '').trim()) return 'Please enter the employee name.';
  const mail = normaliseEmail(email);
  if (!mail) return 'Please enter the employee email.';
  if (!EMAIL.test(mail)) return 'Please enter a valid email, e.g. name@ineos.com';
  if (!editing || password) return checkPasswordRules(password ?? '');
  return null;
}

const args = ({ name, email, departmentId, subDepartmentId }, departments) => {
  const hasSubs = (departments.find((d) => d.id === departmentId)?.subDepartments ?? []).length > 0;
  return {
    p_name: (name ?? '').trim().replace(/\s+/g, ' '),
    p_email: normaliseEmail(email),
    p_department_id: departmentId,
    p_sub_department_id: hasSubs ? subDepartmentId : null,
  };
};

// Actions return an error message string, or null on success.
export async function addEmployee(input, departments) {
  const invalid = validate(input, departments, false);
  if (invalid) return invalid;
  const { error } = await supabase.rpc('admin_create_employee', {
    ...args(input, departments),
    p_password: input.password,
  });
  if (error) return errorMessage(error);
  invalidate('profiles');
  return null;
}

export async function updateEmployee(id, input, departments) {
  const invalid = validate(input, departments, true);
  if (invalid) return invalid;
  const { error } = await supabase.rpc('admin_update_employee', {
    p_id: id,
    ...args(input, departments),
    p_password: input.password || null,
  });
  if (error) return errorMessage(error);
  invalidate('profiles');
  return null;
}

export async function deleteEmployee(id) {
  const { error } = await supabase.rpc('admin_delete_employee', { p_id: id });
  if (error) return errorMessage(error);
  invalidate('profiles', 'attendance');
  return null;
}

// Every employee account can sign in with its email and the password the admin set.
export const canSignIn = (employee) => Boolean(employee?.email);

export function useEmployees() {
  const { data, loading } = useRemote('employees', fetchEmployees, ['profiles']);
  return { employees: data ?? [], loading };
}

// Department / sub-department names for an employee, tolerant of deleted records.
export function describeEmployee(employee, departments) {
  const dept = departments.find((d) => d.id === employee.departmentId);
  const sub = dept?.subDepartments?.find((s) => s.id === employee.subDepartmentId);
  return {
    dept,
    departmentName: dept?.name ?? 'Unknown department',
    subDepartmentName: sub?.name ?? (employee.subDepartmentId ? 'Removed' : '—'),
  };
}
