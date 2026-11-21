import { createPersistentList, newId } from './store';
import { checkPasswordRules, hashPassword, verifyPassword } from './passwords';

// Employees, stored on this device only (see store.js).
// Shape: [{ id, name, email, departmentId, subDepartmentId, password: { salt, hash },
//           createdAt, updatedAt? }]
// email is stored lower-case and is unique; employees sign in with email + password.
// subDepartmentId is '' when the department has no sub-departments.
// The typed password is never stored, only its salted hash (see passwords.js).
const store = createPersistentList('ineos.employees.v1');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const normaliseEmail = (email) => (email ?? '').trim().toLowerCase();

// Checks the form. Returns { error } or { value }.
// `editingId`: the employee being edited (null when adding). When editing, a blank
// password keeps the current one.
function validate(input, departments, list, editingId) {
  const { name, email, departmentId, subDepartmentId, password } = input;

  const dept = departments.find((d) => d.id === departmentId);
  if (!dept) return { error: 'Please select a department.' };

  const subs = dept.subDepartments ?? [];
  if (subs.length > 0 && !subs.some((s) => s.id === subDepartmentId)) {
    return { error: 'Please select a sub-department.' };
  }

  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { error: 'Please enter the employee name.' };

  const mail = normaliseEmail(email);
  if (!mail) return { error: 'Please enter the employee email.' };
  if (!EMAIL.test(mail)) return { error: 'Please enter a valid email, e.g. name@ineos.com' };
  if (list.some((e) => e.id !== editingId && normaliseEmail(e.email) === mail)) {
    return { error: `${mail} is already used by another employee.` };
  }

  if (!editingId || password) {
    const passwordError = checkPasswordRules(password ?? '');
    if (passwordError) return { error: passwordError };
  }

  return {
    value: {
      name: trimmed,
      email: mail,
      departmentId,
      subDepartmentId: subs.length > 0 ? subDepartmentId : '',
    },
  };
}

// Actions return an error message string, or null on success.
export async function addEmployee(input, departments) {
  const list = await store.get();
  const { error, value } = validate(input, departments, list, null);
  if (error) return error;
  const password = await hashPassword(input.password);
  return store.save([
    ...list,
    { id: newId(), ...value, password, createdAt: new Date().toISOString() },
  ]);
}

export async function updateEmployee(id, input, departments) {
  const list = await store.get();
  const { error, value } = validate(input, departments, list, id);
  if (error) return error;
  // Only replace the stored password when a new one was typed.
  const password = input.password ? await hashPassword(input.password) : undefined;
  return store.save(
    list.map((e) =>
      e.id === id
        ? {
            ...e,
            ...value,
            ...(password ? { password } : {}),
            updatedAt: new Date().toISOString(),
          }
        : e
    )
  );
}

export const getAllEmployees = () => store.get();

export async function deleteEmployee(id) {
  const list = await store.get();
  return store.save(list.filter((e) => e.id !== id));
}

// Employee login: resolves to { employee } or { error }.
export async function authenticate(email, password) {
  const mail = normaliseEmail(email);
  if (!mail || !password) return { error: 'Please enter your email and password.' };
  const list = await store.get();
  const employee = list.find((e) => normaliseEmail(e.email) === mail);
  // Same message whether the email or the password is wrong, so emails can't be probed.
  const invalid = { error: 'Incorrect email or password.' };
  if (!employee || !(await verifyPassword(password, employee.password))) return invalid;
  return { employee };
}

export const hasPassword = (employee) => Boolean(employee?.password?.hash);
// Can this employee sign in? Older records may lack an email or password.
export const canSignIn = (employee) => hasPassword(employee) && Boolean(employee?.email);

export function useEmployees() {
  const { items, loading } = store.useList();
  return { employees: items, loading };
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
