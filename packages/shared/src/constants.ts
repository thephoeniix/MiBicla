export const ROLE_NAMES = ['owner', 'admin', 'employee'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const PERMISSION_NAMES = [
  'manage_employees', 'manage_roles', 'manage_settings', 'manage_products',
  'manage_promotions', 'manage_events', 'manage_services', 'manage_customers',
  'view_customers', 'create_customers', 'register_purchase', 'register_service',
  'redeem_reward', 'reverse_movement', 'view_audit_logs', 'view_reports',
] as const;
export type PermissionName = (typeof PERMISSION_NAMES)[number];

export const ROLE_PERMISSIONS: Record<RoleName, readonly PermissionName[]> = {
  owner: PERMISSION_NAMES,
  admin: ['manage_products', 'manage_promotions', 'manage_events', 'manage_services',
    'manage_customers', 'view_customers', 'create_customers', 'register_purchase',
    'register_service', 'redeem_reward', 'reverse_movement', 'view_reports'],
  employee: ['view_customers', 'create_customers', 'register_purchase', 'register_service', 'redeem_reward'],
};

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const SESSION_TOUCH_MS = 5 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5;
export const ACCOUNT_LOCK_ATTEMPTS = 5;
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
export const MAX_AUDIT_METADATA_BYTES = 8_192;
