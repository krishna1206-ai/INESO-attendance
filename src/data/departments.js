import { createPersistentList, newId } from './store';
import { getAllEmployees } from './employees';

// Departments (and their sub-departments) are stored on this device only
// (AsyncStorage; localStorage on web). Replace load/persist with API calls once a backend exists.
//
// Shape: [{ id, name, icon, createdAt,
//           subDepartments: [{ id, name, imageUri, linkUrl, createdAt }] }]
const STORAGE_KEY = 'ineos.departments.v1';

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

const store = createPersistentList(STORAGE_KEY, (d) => ({
  ...d,
  subDepartments: d.subDepartments ?? [],
}));

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

// ---------------------------------------------------------------------------
// Actions. Each returns an error message string, or null on success.

export async function addDepartment({ name, icon }) {
  const cache = await store.get();
  const trimmed = name.trim();
  if (!trimmed) return 'Please enter a department name.';
  if (!icon) return 'Please select an icon.';
  if (cache.some((d) => d.name.toLowerCase() === trimmed.toLowerCase())) {
    return `"${trimmed}" already exists.`;
  }
  return store.save([
    ...cache,
    { id: newId(), name: trimmed, icon, createdAt: new Date().toISOString(), subDepartments: [] },
  ]);
}

export async function updateDepartment(id, { name, icon }) {
  const cache = await store.get();
  if (!cache.some((d) => d.id === id)) return 'Department not found.';
  const trimmed = (name ?? '').trim();
  if (!trimmed) return 'Please enter a department name.';
  if (!icon) return 'Please select an icon.';
  if (cache.some((d) => d.id !== id && d.name.toLowerCase() === trimmed.toLowerCase())) {
    return `"${trimmed}" already exists.`;
  }
  return store.save(
    cache.map((d) =>
      d.id === id ? { ...d, name: trimmed, icon, updatedAt: new Date().toISOString() } : d
    )
  );
}

// Deletes a department together with its sub-departments. Refused while employees still
// belong to it, so nobody is left without a department.
export async function deleteDepartment(id) {
  const employees = await getAllEmployees();
  const count = employees.filter((e) => e.departmentId === id).length;
  if (count > 0) {
    return `This department still has ${count} employee${count === 1 ? '' : 's'}. Move them to another department or delete them first.`;
  }
  const cache = await store.get();
  return store.save(cache.filter((d) => d.id !== id));
}

function validateSubDepartment(dept, { name, imageUri, linkUrl }, editingId) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { error: 'Please enter a sub-department name.' };
  const duplicate = dept.subDepartments.some(
    (s) => s.id !== editingId && s.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) return { error: `"${trimmed}" already exists in ${dept.name}.` };

  const image = (imageUri ?? '').trim();
  if (image && !image.startsWith('data:image/') && !isHttpUrl(normaliseUrl(image))) {
    return { error: 'Image URL is not valid. It should start with http:// or https://' };
  }
  const link = normaliseUrl(linkUrl);
  if (link && !isHttpUrl(link)) {
    return { error: 'Website link is not valid. Example: https://www.ineos.com' };
  }
  return {
    value: {
      name: trimmed,
      imageUri: image.startsWith('data:') ? image : normaliseUrl(image),
      linkUrl: link,
    },
  };
}

function updateDept(cache, deptId, fn) {
  return cache.map((d) => (d.id === deptId ? fn(d) : d));
}

export async function addSubDepartment(deptId, input) {
  const cache = await store.get();
  const dept = cache.find((d) => d.id === deptId);
  if (!dept) return 'Department not found.';
  const { error, value } = validateSubDepartment(dept, input, null);
  if (error) return error;
  return store.save(
    updateDept(cache, deptId, (d) => ({
      ...d,
      subDepartments: [
        ...d.subDepartments,
        { id: newId(), ...value, createdAt: new Date().toISOString() },
      ],
    }))
  );
}

export async function updateSubDepartment(deptId, subId, input) {
  const cache = await store.get();
  const dept = cache.find((d) => d.id === deptId);
  if (!dept) return 'Department not found.';
  const { error, value } = validateSubDepartment(dept, input, subId);
  if (error) return error;
  return store.save(
    updateDept(cache, deptId, (d) => ({
      ...d,
      subDepartments: d.subDepartments.map((s) =>
        s.id === subId ? { ...s, ...value, updatedAt: new Date().toISOString() } : s
      ),
    }))
  );
}

export async function deleteSubDepartment(deptId, subId) {
  const cache = await store.get();
  return store.save(
    updateDept(cache, deptId, (d) => ({
      ...d,
      subDepartments: d.subDepartments.filter((s) => s.id !== subId),
    }))
  );
}

// ---------------------------------------------------------------------------
// Hook

export function useDepartments() {
  const { items, loading } = store.useList();
  return { departments: items, loading, addDepartment };
}
