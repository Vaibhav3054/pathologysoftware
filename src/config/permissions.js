/**
 * Centralized Role-Based Access Control (RBAC) Permission Registry.
 * Designed around two lab roles (lab_owner, receptionist) plus platform super_admin,
 * and structured so additional roles can be added in one place.
 */

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  CREATE_REGISTRATION: 'create_registration',
  MANAGE_PATIENTS: 'manage_patients',
  MANAGE_REPORTS: 'manage_reports',
  VIEW_TESTS: 'view_tests',
  MANAGE_TESTS: 'manage_tests',
  VIEW_DOCTORS: 'view_doctors',
  MANAGE_DOCTORS: 'manage_doctors',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_STAFF: 'manage_staff',
  MANAGE_SUBSCRIPTION: 'manage_subscription',
  VIEW_BACKUP: 'view_backup',
  VIEW_LEGAL: 'view_legal',
  ACCESS_SUPER_ADMIN: 'access_super_admin',
};

const RECEPTIONIST_PERMISSIONS = new Set([
  PERMISSIONS.VIEW_DASHBOARD,
  PERMISSIONS.CREATE_REGISTRATION,
  PERMISSIONS.MANAGE_PATIENTS,
  PERMISSIONS.MANAGE_REPORTS,
  PERMISSIONS.VIEW_TESTS, // Read-only view of tests & prices
  PERMISSIONS.VIEW_DOCTORS, // Read-only dropdown during patient registration
  PERMISSIONS.VIEW_LEGAL,
]);

const OWNER_PERMISSIONS = new Set([
  ...RECEPTIONIST_PERMISSIONS,
  PERMISSIONS.MANAGE_TESTS,
  PERMISSIONS.MANAGE_DOCTORS,
  PERMISSIONS.MANAGE_SETTINGS,
  PERMISSIONS.MANAGE_STAFF,
  PERMISSIONS.MANAGE_SUBSCRIPTION,
  PERMISSIONS.VIEW_BACKUP,
]);

const SUPER_ADMIN_PERMISSIONS = new Set([
  ...OWNER_PERMISSIONS,
  PERMISSIONS.ACCESS_SUPER_ADMIN,
]);

const ROLE_PERMISSION_MAP = {
  super_admin: SUPER_ADMIN_PERMISSIONS,
  lab_owner: OWNER_PERMISSIONS,
  receptionist: RECEPTIONIST_PERMISSIONS,
  // Legacy fallback mapped to receptionist operational scope
  technician: RECEPTIONIST_PERMISSIONS,
};

export const VIEW_REQUIRED_PERMISSION = {
  'super-admin': PERMISSIONS.ACCESS_SUPER_ADMIN,
  dashboard: PERMISSIONS.VIEW_DASHBOARD,
  'new-entry': PERMISSIONS.CREATE_REGISTRATION,
  patients: PERMISSIONS.MANAGE_PATIENTS,
  reports: PERMISSIONS.MANAGE_REPORTS,
  'report-entry': PERMISSIONS.MANAGE_REPORTS,
  'report-view': PERMISSIONS.MANAGE_REPORTS,
  tests: PERMISSIONS.VIEW_TESTS,
  doctors: PERMISSIONS.MANAGE_DOCTORS, // Receptionists are blocked from DoctorsManager
  settings: PERMISSIONS.MANAGE_SETTINGS, // Receptionists are blocked from Settings
  backup: PERMISSIONS.VIEW_BACKUP,
  legal: PERMISSIONS.VIEW_LEGAL,
};

export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const set = ROLE_PERMISSION_MAP[role];
  return Boolean(set && set.has(permission));
}

export function canAccessView(role, viewId) {
  const required = VIEW_REQUIRED_PERMISSION[viewId];
  if (!required) return true;
  return hasPermission(role, required);
}

export function getRoleDisplayLabel(role) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'lab_owner') return 'Owner (Full Access)';
  if (role === 'receptionist') return 'Receptionist';
  if (role === 'technician') return 'Receptionist / Staff';
  return 'Staff';
}
