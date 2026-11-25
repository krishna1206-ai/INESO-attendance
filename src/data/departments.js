import { db, errorMessage } from '../lib/supabase';
import { invalidate, useRemote } from './remote';

// Departments and their sub-departments, stored in Supabase (tables `departments` and
// `sub_departments`). Everyone signed in can read them; only admins can change them
// (Row Level Security, see supabase/schema.sql).
//
// Shape used by the screens:
//   [{ id, name, icon, createdAt,
//      subDepartments: [{ id, name, imageUri, linkUrl, createdAt }] }]

// Chemical-industry icons the admin can pick from when creating a department
// (MaterialCommunityIcons names). Grouped in rows of 7 to fill the picker evenly.
export const DEPARTMENT_ICONS = [
  // Laboratory & chemistry
  'flask-outline',
  'flask-round-bottom-outline',
  'beaker-outline',
  'test-tube',
  'molecule',
  'atom',
  'microscope',
  // Plant & process
  'factory',
  'pipe-valve',
  'valve',
  'gauge',
  'thermometer',
  'fire',
  'cog-outline',
  // Oil, gas, logistics & safety
  'barrel',
  'oil',
  'gas-cylinder',
  'tanker-truck',
  'ferry',
  'hard-hat',
  'safety-goggles',
];

const TABLES = ['departments', 'sub_departments'];

async function fetchDepartments() {
  const [deps, subs] = await Promise.all([
    db().from('departments').select('id, name, icon, created_at').order('created_at'),
    db()
      .from('sub_departments')
      .select('id, department_id, name, image_uri, link_url, created_at')
      .order('created_at'),
  ]);
  if (deps.error) throw deps.error;
  if (subs.error) throw subs.error;
  return deps.data.map((d) => ({
    id: d.id,
    name: d.name,
    icon: d.icon,
    createdAt: d.created_at,
    subDepartments: subs.data
      .filter((s) => s.department_id === d.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        imageUri: s.image_uri,
        linkUrl: s.link_url,
        createdAt: s.created_at,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Validation helpers

// http(s) URL with a real-looking host (has a dot, or is localhost) and no spaces.
// A regex rather than `new URL()`: browsers accept odd hosts like "not a link", and
// React Native's URL implementation is incomplete.
const HTTP_URL = /^https?:\/\/(localhost|[^\s/?#.:]+(\.[^\s/?#.:]+)+)(:\d+)?([/?#]\S*)?$/i;
const isHttpUrl = (value) => HTTP_URL.test(value);

// Adds https:// when the admin types "www.example.com". Returns '' for empty input.
export function normaliseUrl(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const duplicate = (error, name, where = '') =>
  error?.code === '23505' ? `"${name}" already exists${where}.` : errorMessage(error);

// ---------------------------------------------------------------------------
// Actions. Each returns an error message string, or null on success.

export async function addDepartment({ name, icon }) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'Please enter a department name.';
  if (!icon) return 'Please select an icon.';
  const { error } = await db().from('departments').insert({ name: trimmed, icon });
  if (error) return duplicate(error, trimmed);
  invalidate(...TABLES);
  return null;
}

export async function updateDepartment(id, { name, icon }) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'Please enter a department name.';
  if (!icon) return 'Please select an icon.';
  const { error } = await db()
    .from('departments')
    .update({ name: trimmed, icon, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return duplicate(error, trimmed);
  invalidate(...TABLES);
  return null;
}

// Deletes a department together with its sub-departments. Refused while employees still
// belong to it, so nobody is left without a department.
export async function deleteDepartment(id) {
  const { count, error: countError } = await db()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', id);
  if (countError) return errorMessage(countError);
  if (count > 0) {
    return `This department still has ${count} employee${count === 1 ? '' : 's'}. Move them to another department or delete them first.`;
  }
  const { error } = await db().from('departments').delete().eq('id', id);
  if (error) {
    return error.code === '23503'
      ? 'This department still has employees. Move them to another department or delete them first.'
      : errorMessage(error);
  }
  invalidate(...TABLES);
  return null;
}

// Sub-departments have a name and an optional image (upload or image URL). The website-link
// field was removed from the form; the database column stays empty.
function validateSubDepartment({ name, imageUri }) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { error: 'Please enter a sub-department name.' };

  const image = (imageUri ?? '').trim();
  if (image && !image.startsWith('data:image/') && !isHttpUrl(normaliseUrl(image))) {
    return { error: 'Image URL is not valid. It should start with http:// or https://' };
  }
  return {
    value: {
      name: trimmed,
      image_uri: image.startsWith('data:') ? image : normaliseUrl(image),
      link_url: '',
    },
  };
}

export async function addSubDepartment(deptId, input) {
  const { error: invalid, value } = validateSubDepartment(input);
  if (invalid) return invalid;
  const { error } = await db().from('sub_departments').insert({ department_id: deptId, ...value });
  if (error) return duplicate(error, value.name, ' in this department');
  invalidate(...TABLES);
  return null;
}

export async function updateSubDepartment(deptId, subId, input) {
  const { error: invalid, value } = validateSubDepartment(input);
  if (invalid) return invalid;
  const { error } = await db()
    .from('sub_departments')
    .update({ ...value, updated_at: new Date().toISOString() })
    .eq('id', subId)
    .eq('department_id', deptId);
  if (error) return duplicate(error, value.name, ' in this department');
  invalidate(...TABLES);
  return null;
}

export async function deleteSubDepartment(deptId, subId) {
  const { error } = await db()
    .from('sub_departments')
    .delete()
    .eq('id', subId)
    .eq('department_id', deptId);
  if (error) return errorMessage(error);
  invalidate(...TABLES, 'profiles');
  return null;
}

// ---------------------------------------------------------------------------
// Hook

export function useDepartments() {
  const { data, loading } = useRemote('departments', fetchDepartments, TABLES);
  return { departments: data ?? [], loading, addDepartment };
}
