/**
 * Check if a user has a specific permission.
 * Owner and Admin roles automatically have ALL permissions.
 * 
 * @param {Object} user - The user object from session or state
 * @param {string} permissionKey - The permission identifier (e.g., 'view_history', 'view_pricing')
 * @returns {boolean} True if authorized, false otherwise
 */
export function hasPermission(user, permissionKey) {
  if (!user) return false;
  
  const role = (user.role || '').toLowerCase();
  // Owner and Admin automatically have ALL permissions across the entire system
  if (role === 'admin' || role === 'owner') {
    return true;
  }

  if (!permissionKey) return true;

  // Check operator permissions array
  if (Array.isArray(user.permissions)) {
    return user.permissions.includes(permissionKey);
  }

  return false;
}
