import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Edit2,
  Plus,
  RefreshCw,
  ArrowLeft,
  ListFilter,
  Trash2,
  ShieldAlert,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sliders,
  Sparkles,
  Lock,
  Layers,
  Database,
  TrendingUp,
  FileSignature,
  Warehouse,
  Package,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  ROLE_PRESETS,
  PERMISSION_MATRIX_COLS,
  PERMISSION_MATRIX_ROWS,
  MINIMIZED_MATRIX_CATEGORIES,
  SPECIAL_CAPABILITIES,
  detectAssignedRoles
} from '../utils/permissions';

const EMPTY_FORM = {
  username: '',
  role: 'operator',
  permissions: []
};

const CATEGORY_ICONS = {
  trade: TrendingUp,
  contracts: FileSignature,
  inventory_mfg: Warehouse,
  masters: Package,
  system: ShieldAlert
};

const CATEGORY_COLORS = {
  trade: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  contracts: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', active: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  inventory_mfg: { bg: 'bg-amber-50 text-amber-700 border-amber-200', active: 'bg-amber-100 text-amber-800 border-amber-300' },
  masters: { bg: 'bg-blue-50 text-blue-700 border-blue-200', active: 'bg-blue-100 text-blue-800 border-blue-300' },
  system: { bg: 'bg-pink-50 text-pink-700 border-pink-200', active: 'bg-pink-100 text-pink-800 border-pink-300' }
};

const UNIQUE_ROLE_PRESETS = [
  ROLE_PRESETS.boss,
  ROLE_PRESETS.inventory_manager,
  ROLE_PRESETS.data_feeder,
  ROLE_PRESETS.manufacture_manager,
  ROLE_PRESETS.order_manager,
  ROLE_PRESETS.contract_manager,
  ROLE_PRESETS.only_contract_forms,
  ROLE_PRESETS.hr_manager,
  ROLE_PRESETS.system_admin,
  ROLE_PRESETS.view_trade
].filter(Boolean);

// Modern iOS-style toggle switch component
function ToggleSwitch({ checked, onChange, disabled, label, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${checked ? 'bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'}`}
    >
      <span className="sr-only">{label || 'Toggle'}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full  bg-[white] shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      <span className={`absolute text-[8px] font-black uppercase tracking-tight pointer-events-none ${
        checked ? 'left-1 text-white' : 'right-1 text-slate-600'
      }`}>
        {checked ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

export default function AddUserView() {
  const navigate = useNavigate();
  const location = useLocation();
  const isFormRoute = location.pathname.endsWith('/form');
  const [viewMode, setViewMode] = useState(isFormRoute ? 'form' : 'list');
  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null); // username is the editing primary key
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Multi-role selection: array of active role keys
  const [selectedRoles, setSelectedRoles] = useState([]);

  // Additional privileges collapsible section toggle
  const [showAdditionalPrivileges, setShowAdditionalPrivileges] = useState(false);

  // Accordion state for Minimized Operations Matrix categories
  const [expandedCategories, setExpandedCategories] = useState({
    trade: true,
    contracts: true,
    inventory_mfg: false,
    masters: false,
    system: false
  });

  // Toggle a role ON or OFF (Multi-role composition)
  const toggleRole = (roleKey) => {
    let nextRoles = [...selectedRoles];
    const isCurrentlyActive = nextRoles.includes(roleKey);

    if (roleKey === 'boss') {
      if (isCurrentlyActive) {
        setFormData((prev) => ({
          ...prev,
          role: 'operator',
          permissions: []
        }));
        setSelectedRoles([]);
        toast.info('Removed Boss / Admin role');
        return;
      } else {
        setFormData((prev) => ({
          ...prev,
          role: 'admin',
          permissions: ['*', 'role:boss']
        }));
        setSelectedRoles(['boss']);
        toast.success('Granted Boss / Administrator (Full Access)');
        return;
      }
    }

    if (nextRoles.includes('boss')) {
      nextRoles = nextRoles.filter((r) => r !== 'boss');
    }

    if (isCurrentlyActive) {
      nextRoles = nextRoles.filter((r) => r !== roleKey);
    } else {
      nextRoles.push(roleKey);
    }

    setSelectedRoles(nextRoles);

    const rolesPermSet = new Set();
    nextRoles.forEach((r) => {
      rolesPermSet.add(`role:${r}`);
      const preset = ROLE_PRESETS[r];
      if (preset) {
        preset.permissions.forEach((p) => rolesPermSet.add(p));
      }
    });

    const nonRolePerms = formData.permissions.filter(
      (p) => !p.startsWith('role:') && p !== '*'
    );

    if (isCurrentlyActive) {
      const removedPreset = ROLE_PRESETS[roleKey];
      const otherActivePerms = new Set();
      nextRoles.forEach((r) => {
        const pset = ROLE_PRESETS[r];
        if (pset) pset.permissions.forEach((p) => otherActivePerms.add(p));
      });

      const updatedManualPerms = nonRolePerms.filter((p) => {
        if (removedPreset && removedPreset.permissions.includes(p) && !otherActivePerms.has(p)) {
          return false;
        }
        return true;
      });

      const finalPerms = Array.from(new Set([...rolesPermSet, ...updatedManualPerms]));
      setFormData((prev) => ({
        ...prev,
        role: nextRoles.includes('boss') ? 'admin' : 'operator',
        permissions: finalPerms
      }));
      toast.info(`Removed '${ROLE_PRESETS[roleKey]?.label}' role`);
    } else {
      const finalPerms = Array.from(new Set([...rolesPermSet, ...nonRolePerms]));
      setFormData((prev) => ({
        ...prev,
        role: nextRoles.includes('boss') ? 'admin' : 'operator',
        permissions: finalPerms
      }));
      toast.success(`Added '${ROLE_PRESETS[roleKey]?.label}' role`);
    }
  };

  // Real-time user database availability state for Add mode
  const [availabilityState, setAvailabilityState] = useState({
    loading: false,
    checked: false,
    exists: null,
    available: null,
    status: '',
    message: '',
    user: null
  });

  // Database verification state for Update mode
  const [updateUserVerify, setUpdateUserVerify] = useState({
    loading: false,
    verified: null,
    message: ''
  });

  useEffect(() => {
    // Get currently logged in user context
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  useEffect(() => {
    if (isFormRoute) {
      setViewMode('form');
      if (location.state?.editingUser) {
        const u = location.state.editingUser;
        const uPerms = Array.isArray(u.permissions) ? u.permissions : [];
        setEditingId(u.username);
        setSelectedRoles(detectAssignedRoles(uPerms, u.role));
        setFormData({
          username: u.username || '',
          role: u.role || 'operator',
          permissions: uPerms
        });
      } else {
        setEditingId(null);
        setSelectedRoles([]);
        setFormData(EMPTY_FORM);
      }
    } else {
      setViewMode('list');
    }
  }, [location.pathname, location.state, isFormRoute]);

  useEffect(() => {
    if (!isFormRoute) {
      fetchUsers();
    }
  }, [isFormRoute]);

  // Debounced check user availability in database (Add Mode)
  useEffect(() => {
    if (viewMode !== 'form' || editingId) return;

    const trimmed = (formData.username || '').trim();
    if (!trimmed || trimmed.length < 2) {
      setAvailabilityState({
        loading: false,
        checked: false,
        exists: null,
        available: null,
        status: '',
        message: '',
        user: null
      });
      return;
    }

    setAvailabilityState(prev => ({ ...prev, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check/${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setAvailabilityState({
            loading: false,
            checked: true,
            exists: data.exists,
            available: data.available,
            status: data.status,
            message: data.message,
            user: data.user || null
          });
        } else {
          setAvailabilityState({
            loading: false,
            checked: false,
            exists: null,
            available: null,
            status: 'error',
            message: 'Unable to verify user in database',
            user: null
          });
        }
      } catch (err) {
        console.error('Check user error:', err);
        setAvailabilityState({
          loading: false,
          checked: false,
          exists: null,
          available: null,
          status: 'error',
          message: 'Network error verifying user in database',
          user: null
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.username, viewMode, editingId]);

  // Verify user availability in database (Update Mode)
  useEffect(() => {
    if (viewMode === 'form' && editingId) {
      setUpdateUserVerify({ loading: true, verified: null, message: 'Verifying user in database...' });
      fetch(`/api/users/${encodeURIComponent(editingId)}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setUpdateUserVerify({ loading: false, verified: true, message: 'User verified in database' });
            if (Array.isArray(data.permissions)) {
              setFormData(prev => ({
                username: data.username,
                permissions: data.permissions
              }));
            }
          } else {
            setUpdateUserVerify({
              loading: false,
              verified: false,
              message: 'User not found in database or not associated with your company.'
            });
          }
        })
        .catch(err => {
          console.error(err);
          setUpdateUserVerify({
            loading: false,
            verified: false,
            message: 'Network error checking database.'
          });
        });
    }
  }, [viewMode, editingId]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      toast.error('Username is required');
      return;
    }

    // In Add mode, check availability validation
    if (!editingId && availabilityState.checked && availabilityState.available === false) {
      toast.error(availabilityState.message || 'User is not available in database');
      return;
    }

    // In Update mode, ensure user exists
    if (editingId && updateUserVerify.verified === false) {
      toast.error('Cannot save: User not found in database.');
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        // Update user
        const res = await fetch(`/api/users/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            permissions: formData.permissions,
            role: selectedRoles.includes('boss') ? 'admin' : (formData.role || 'operator')
          })
        });
        if (res.ok) {
          toast.success('User permissions updated successfully!');
          navigate(-1);
        } else {
          const errData = await res.json();
          toast.error(errData.error || 'Failed to update user');
        }
      } else {
        // Create user (password defaults to username in backend)
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.username.trim(),
            role: selectedRoles.includes('boss') ? 'admin' : (formData.role || 'operator'),
            permissions: formData.permissions
          })
        });
        if (res.ok) {
          toast.success('User registered successfully!');
          navigate(-1);
        } else {
          const errData = await res.json();
          toast.error(errData.error || 'Failed to add user');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while saving user info');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (!window.confirm(`Are you sure you want to delete user "${userToDelete.username}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userToDelete.username)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setUsers(users.filter(u => u.username !== userToDelete.username));
        toast.success('User deleted successfully.');
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred during deletion.');
    }
  };

  const handleEditClick = (user) => {
    navigate('/users/form', { state: { editingUser: user } });
  };

  const handleOpenAddForm = () => {
    navigate('/users/form');
  };

  const toggleCategoryExpand = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const expandAllCategories = () => {
    const all = {};
    Object.keys(MINIMIZED_MATRIX_CATEGORIES).forEach(k => { all[k] = true; });
    setExpandedCategories(all);
  };

  const collapseAllCategories = () => {
    const none = {};
    Object.keys(MINIMIZED_MATRIX_CATEGORIES).forEach(k => { none[k] = false; });
    setExpandedCategories(none);
  };

  const areAllExpanded = Object.keys(MINIMIZED_MATRIX_CATEGORIES).every(k => expandedCategories[k]);

  // Toggle single cell in matrix
  const toggleMatrixCell = (rowKey, colKey) => {
    const permKey = `${rowKey}:${colKey}`;
    const isSuper = formData.permissions.includes('*') || formData.role === 'admin';
    let currentList = Array.isArray(formData.permissions) ? [...formData.permissions] : [];

    // If ARC delete and not boss
    if (rowKey === 'arc' && colKey === 'delete' && !isSuper) {
      toast.warning('ARC Contract Deletion is strictly restricted to Boss / Administrator.');
      return;
    }

    if (isSuper) {
      const allPerms = [];
      PERMISSION_MATRIX_ROWS.forEach(r => {
        PERMISSION_MATRIX_COLS.forEach(c => {
          if (!(r.restrictDelete && c.key === 'delete')) {
            allPerms.push(`${r.key}:${c.key}`);
          }
        });
      });
      SPECIAL_CAPABILITIES.forEach(cap => allPerms.push(cap.key));
      allPerms.push('orders:view_page', 'trades:view_all', 'trades:search');
      currentList = Array.from(new Set(allPerms)).filter(p => p !== permKey && p !== '*');
      const nextRoles = detectAssignedRoles(currentList, 'operator');
      setSelectedRoles(nextRoles);
      setFormData(prev => ({ ...prev, role: 'operator', permissions: currentList }));
      return;
    }

    const index = currentList.indexOf(permKey);
    if (index > -1) {
      currentList.splice(index, 1);
    } else {
      currentList.push(permKey);
    }

    const nextRoles = detectAssignedRoles(currentList, formData.role);
    setSelectedRoles(nextRoles);
    setFormData(prev => ({ ...prev, permissions: currentList }));
  };

  // Quick row actions ('all', 'read', 'clear')
  const toggleRowQuick = (rowKey, mode) => {
    const row = PERMISSION_MATRIX_ROWS.find(r => r.key === rowKey);
    const rowPerms = PERMISSION_MATRIX_COLS
      .filter(c => !(row?.restrictDelete && c.key === 'delete'))
      .map(c => `${rowKey}:${c.key}`);

    let currentList = Array.isArray(formData.permissions) ? formData.permissions.filter(p => p !== '*') : [];

    if (mode === 'all') {
      rowPerms.forEach(p => {
        if (!currentList.includes(p)) currentList.push(p);
      });
    } else if (mode === 'read') {
      currentList = currentList.filter(p => !rowPerms.includes(p));
      currentList.push(`${rowKey}:read`);
    } else if (mode === 'clear') {
      currentList = currentList.filter(p => !rowPerms.includes(p));
    }

    const nextRoles = detectAssignedRoles(currentList, 'operator');
    setSelectedRoles(nextRoles);
    setFormData(prev => ({ ...prev, role: 'operator', permissions: currentList }));
  };

  // Bulk category toggle
  const toggleCategoryBulk = (catKey, enable) => {
    const catRows = PERMISSION_MATRIX_ROWS.filter(r => r.category === catKey);
    const targetPerms = [];
    catRows.forEach(r => {
      PERMISSION_MATRIX_COLS.forEach(c => {
        if (!(r.restrictDelete && c.key === 'delete')) {
          targetPerms.push(`${r.key}:${c.key}`);
        }
      });
    });

    let currentList = Array.isArray(formData.permissions) ? formData.permissions.filter(p => p !== '*') : [];
    if (enable) {
      targetPerms.forEach(p => {
        if (!currentList.includes(p)) currentList.push(p);
      });
    } else {
      currentList = currentList.filter(p => !targetPerms.includes(p));
    }

    const nextRoles = detectAssignedRoles(currentList, 'operator');
    setSelectedRoles(nextRoles);
    setFormData(prev => ({ ...prev, role: 'operator', permissions: currentList }));
  };

  // Global matrix bulk actions
  const enableReadOnlyMatrix = () => {
    let currentList = Array.isArray(formData.permissions) ? formData.permissions.filter(p => p !== '*') : [];
    PERMISSION_MATRIX_ROWS.forEach(r => {
      const readPerm = `${r.key}:read`;
      if (!currentList.includes(readPerm)) currentList.push(readPerm);
    });
    const nextRoles = detectAssignedRoles(currentList, 'operator');
    setSelectedRoles(nextRoles);
    setFormData(prev => ({ ...prev, role: 'operator', permissions: currentList }));
    toast.info('Enabled read-only for all modules');
  };

  const clearAllMatrix = () => {
    setFormData(prev => ({ ...prev, role: 'operator', permissions: [] }));
    setSelectedRoles([]);
    toast.info('Cleared all permissions and roles');
  };

  // Special capability toggle
  const toggleSpecialCapability = (capKey) => {
    const isSuper = formData.permissions.includes('*') || formData.role === 'admin';
    let currentList = Array.isArray(formData.permissions) ? [...formData.permissions] : [];

    if (isSuper) {
      const allPerms = [];
      PERMISSION_MATRIX_ROWS.forEach(r => {
        PERMISSION_MATRIX_COLS.forEach(c => {
          if (!(r.restrictDelete && c.key === 'delete')) {
            allPerms.push(`${r.key}:${c.key}`);
          }
        });
      });
      SPECIAL_CAPABILITIES.forEach(cap => allPerms.push(cap.key));
      currentList = Array.from(new Set(allPerms)).filter(p => p !== capKey && p !== '*');
      const nextRoles = detectAssignedRoles(currentList, 'operator');
      setSelectedRoles(nextRoles);
      setFormData(prev => ({ ...prev, role: 'operator', permissions: currentList }));
      return;
    }

    const index = currentList.indexOf(capKey);
    if (index > -1) {
      currentList.splice(index, 1);
    } else {
      currentList.push(capKey);
    }

    const nextRoles = detectAssignedRoles(currentList, formData.role);
    setSelectedRoles(nextRoles);
    setFormData(prev => ({ ...prev, permissions: currentList }));
  };

  // Matrix counter calculations
  const activeMatrixCount = PERMISSION_MATRIX_ROWS.reduce((acc, row) => {
    const count = PERMISSION_MATRIX_COLS.filter(c =>
      formData.permissions.includes(`${row.key}:${c.key}`) || formData.permissions.includes('*') || formData.role === 'admin'
    ).length;
    return acc + count;
  }, 0);

  const totalMatrixCells = PERMISSION_MATRIX_ROWS.length * PERMISSION_MATRIX_COLS.length;

  const filteredUsers = users.filter(u =>
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.company_name && u.company_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Format permission badges for list view
  const renderPermissionsBadge = (u) => {
    const r = (u.role || '').toLowerCase();
    const perms = Array.isArray(u.permissions) ? u.permissions : [];

    if (r === 'admin' || r === 'owner' || perms.includes('*') || perms.includes('role:boss')) {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full inline-flex items-center gap-1 shadow-xs">
          <ShieldAlert size={10} className="text-emerald-600" />
          Boss / Admin (Full Access)
        </span>
      );
    }

    const assigned = detectAssignedRoles(perms, u.role);
    if (assigned.length > 0) {
      return (
        <div className="flex flex-wrap gap-1 max-w-sm">
          {assigned.map((roleKey) => {
            const preset = ROLE_PRESETS[roleKey];
            if (!preset) return null;
            return (
              <span
                key={roleKey}
                className={`px-2 py-0.5 text-[9.5px] font-black rounded-full border inline-flex items-center gap-1 shadow-xs ${preset.badgeClass}`}
              >
                <Sparkles size={9} />
                {preset.label}
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <span className="px-2.5 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-full inline-flex items-center gap-1">
        <Sliders size={10} className="text-slate-500" />
        Custom Operator ({perms.length} privileges)
      </span>
    );
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">User Accounts</h1>
              <p className="text-xs text-slate-500 mt-1">
                Manage operator accounts, assigned roles, page access, and privacy controls.
              </p>
            </div>
            <button
              onClick={handleOpenAddForm}
              className="px-4 py-2 text-white font-semibold text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--theme-color)' }}
              onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
              onMouseLeave={(e) => e.target.style.filter = 'none'}
            >
              <Plus size={16} />
              Add User
            </button>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2  bg-[white] shadow-sm transition-colors"
            style={{ borderColor: searchFocused ? 'var(--theme-color)' : 'rgb(203, 213, 225)' }}
          >
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search users by username or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
            />
          </div>

          {/* Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden  bg-[white] shadow-sm">
            <div className="bg-slate-100 px-5 py-3 border-b border-slate-300">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter size={14} style={{ color: 'var(--theme-color)' }} />
                Users in Company ({filteredUsers.length})
              </span>
            </div>

            {isLoading && users.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                Loading users directory...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-medium">
                No users found. Click "+ Add User" to set up profiles.
              </div>
            ) : (
              <div className="overflow-x-auto  bg-[white]">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3">Username</th>
                      <th className="px-5 py-3">Company ID</th>
                      <th className="px-5 py-3">Company Name</th>
                      <th className="px-5 py-3">Assigned Roles & Access Scope</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200  bg-[white]">
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.username}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-bold text-slate-950 font-mono">
                          {u.username}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-500 font-mono">
                          {u.company_id || '-'}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                          {u.company_name || '-'}
                        </td>
                        <td className="px-5 py-3.5">
                          {renderPermissionsBadge(u)}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => handleEditClick(u)}
                            className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded font-semibold  bg-[white] text-slate-700 hover:border-slate-800 transition-all inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={11} /> Edit
                          </button>
                          {currentUser && currentUser.username !== u.username && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="px-2.5 py-1.5 text-[11px] border border-red-200 rounded font-semibold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================================================================
            VIEW MODE: FULL PAGE FORM WITH MATRIX AND AVAILABILITY CHECK
           ================================================================ */
        <div className="max-w-4xl mx-auto space-y-5">
          {/* Header with Back */}
          <button
            onClick={() => navigate(-1)}
            className="mb-2 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start shadow-sm"
          >
            <ArrowLeft size={14} />
            Back to Users Directory
          </button>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-300 pb-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">
                {editingId ? `Update Permissions for: ${editingId}` : 'Add New User'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure roles, direct page entry, and privacy privileges.
              </p>
            </div>
            {editingId && (
              <span className="px-3 py-1 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Database size={13} /> Edit Mode
              </span>
            )}
          </div>

          <div className=" bg-[white] border border-slate-300 rounded-xl p-6 shadow-sm">
            <form onSubmit={handleAddUser} className="space-y-6">
              
              {/* Username Field with Database Availability Check */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Username <span className="text-red-500">*</span>
                </label>
                
                <div className="relative">
                  <input
                    type="text"
                    required
                    disabled={!!editingId}
                    placeholder="e.g. jsmith"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3.5 py-2.5  bg-[white] disabled:bg-slate-100 disabled:text-slate-500 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 font-semibold focus:outline-none transition-all pr-10"
                    onFocus={(e) => !editingId && (e.target.style.borderColor = 'var(--theme-color)')}
                    onBlur={(e) => !editingId && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
                  />

                  {/* Spinner inside input when checking in Add mode */}
                  {!editingId && availabilityState.loading && (
                    <div className="absolute right-3 top-3 text-slate-400">
                      <Loader2 size={16} className="animate-spin" />
                    </div>
                  )}
                </div>

                {/* Database Availability Status Indicator for Add Mode */}
                {!editingId && (
                  <div className="pt-1">
                    {availabilityState.loading ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium animate-pulse">
                        <Database size={13} className="text-slate-400" />
                        <span>Checking user availability in database...</span>
                      </div>
                    ) : availabilityState.checked ? (
                      <div>
                        {availabilityState.status === 'not_found' && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                            <span>{availabilityState.message}</span>
                          </div>
                        )}

                        {availabilityState.status === 'available_to_enroll' && (
                          <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-md">
                            <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                            <span>
                              {availabilityState.message}
                              {availabilityState.user?.name && ` (${availabilityState.user.name})`}
                            </span>
                          </div>
                        )}

                        {availabilityState.status === 'already_enrolled' && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md">
                            <AlertCircle size={14} className="text-amber-600 shrink-0" />
                            <span>{availabilityState.message} Please edit their existing account instead.</span>
                          </div>
                        )}

                        {availabilityState.status === 'taken' && (
                          <div className="flex items-center gap-1.5 text-xs text-red-700 font-semibold bg-red-50 border border-red-200 px-3 py-1.5 rounded-md">
                            <AlertCircle size={14} className="text-red-600 shrink-0" />
                            <span>{availabilityState.message}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-medium">
                        Type a username to verify its status in the system database.
                      </p>
                    )}
                  </div>
                )}

                {/* Database Verification Status for Update Mode */}
                {editingId && (
                  <div className="pt-1">
                    {updateUserVerify.loading ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Loader2 size={13} className="animate-spin text-slate-400" />
                        <span>Verifying account status in database...</span>
                      </div>
                    ) : updateUserVerify.verified ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>User account confirmed in database. You can adjust permissions below.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-red-700 font-semibold bg-red-50 border border-red-200 px-3 py-1.5 rounded-md">
                        <AlertCircle size={14} className="text-red-600 shrink-0" />
                        <span>{updateUserVerify.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ================================================================
                  SECTION 1: ASSIGNED POSITIONS & ROLES (10 MULTI-SELECT PRESETS)
                 ================================================================ */}
              <div className="p-4 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles size={16} className="text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Assigned Positions & Roles (Multi-Select)
                    </span>
                    {selectedRoles.length > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {selectedRoles.length} {selectedRoles.length === 1 ? 'Role' : 'Roles'} Active
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Select 1 or more positions (e.g. Data Feeder + Only Contract Form)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {UNIQUE_ROLE_PRESETS.map((preset) => {
                    const isSelected = selectedRoles.includes(preset.key);
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => toggleRole(preset.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-indigo-400 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black transition-colors ${
                          isSelected ? 'bg-indigo-500 text-white' : 'border border-slate-400 text-transparent'
                        }`}>
                          ✓
                        </span>
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}

                  {selectedRoles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoles([]);
                        setFormData((prev) => ({
                          ...prev,
                          role: 'operator',
                          permissions: []
                        }));
                        toast.info('Cleared all assigned roles');
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-500 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors cursor-pointer"
                    >
                      Clear Roles
                    </button>
                  )}
                </div>

                {selectedRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedRoles.map((rk) => {
                      const p = ROLE_PRESETS[rk];
                      if (!p) return null;
                      return (
                        <div key={rk} className="text-[11px] text-slate-600 bg-white/90 border border-slate-200 rounded-lg px-2.5 py-1 font-medium flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{p.label}:</span>
                          <span className="text-slate-500">{p.description}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ================================================================
                  SECTION 2: MINIMIZED OPERATIONS MATRIX (5 CATEGORIES)
                  Compact, collapsible functional groups with fine-grained CRUD pills
                 ================================================================ */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-indigo-600" />
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Operations Permission Matrix
                      </label>
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {activeMatrixCount} / {totalMatrixCells} Active Operations
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Fine-tune individual operation access across modules (Create, Read, Edit, Void).
                    </p>
                  </div>

                  {/* Matrix Quick Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => areAllExpanded ? collapseAllCategories() : expandAllCategories()}
                      className="px-2.5 py-1 text-[11px] font-bold rounded bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {areAllExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                      <span>{areAllExpanded ? 'Minimize All' : 'Expand All'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={enableReadOnlyMatrix}
                      className="px-2.5 py-1 text-[11px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Read Only
                    </button>
                    <button
                      type="button"
                      onClick={clearAllMatrix}
                      className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* 5 Collapsible Category Cards */}
                <div className="space-y-2.5">
                  {Object.entries(MINIMIZED_MATRIX_CATEGORIES).map(([catKey, cat]) => {
                    const catRows = PERMISSION_MATRIX_ROWS.filter(r => r.category === catKey);
                    if (catRows.length === 0) return null;

                    const CatIcon = CATEGORY_ICONS[catKey] || Layers;
                    const catColors = CATEGORY_COLORS[catKey] || { bg: 'bg-slate-50 text-slate-700 border-slate-200', active: 'bg-slate-100 text-slate-800 border-slate-300' };
                    const isExpanded = !!expandedCategories[catKey];

                    const totalCatOps = catRows.length * PERMISSION_MATRIX_COLS.length;
                    const activeCatOps = catRows.reduce((acc, row) => {
                      const count = PERMISSION_MATRIX_COLS.filter(col =>
                        formData.permissions.includes(`${row.key}:${col.key}`) || formData.permissions.includes('*') || formData.role === 'admin'
                      ).length;
                      return acc + count;
                    }, 0);

                    return (
                      <div key={catKey} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all">
                        {/* Category Accordion Header */}
                        <div
                          className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                          onClick={() => toggleCategoryExpand(catKey)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg border ${catColors.bg} shrink-0`}>
                              <CatIcon size={15} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">{cat.label}</span>
                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${
                                  activeCatOps > 0 ? catColors.active : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                  {activeCatOps} / {totalCatOps} Active
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 hidden sm:block mt-0.5">{cat.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleCategoryBulk(catKey, true)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                            >
                              Allow Category
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCategoryBulk(catKey, false)}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCategoryExpand(catKey)}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title={isExpanded ? 'Collapse Category' : 'Expand Category'}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Category Rows (When Expanded) */}
                        {isExpanded && (
                          <div className="divide-y divide-slate-100 bg-white">
                            {catRows.map((row) => {
                              const rowPerms = PERMISSION_MATRIX_COLS.map(c => `${row.key}:${c.key}`);
                              const allRowEnabled = rowPerms.every(p => formData.permissions.includes(p) || formData.permissions.includes('*') || formData.role === 'admin');
                              const anyRowEnabled = rowPerms.some(p => formData.permissions.includes(p) || formData.permissions.includes('*') || formData.role === 'admin');

                              return (
                                <div
                                  key={row.key}
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 transition-colors gap-2.5 ${
                                    anyRowEnabled ? 'bg-slate-50/40' : 'hover:bg-slate-50/60'
                                  }`}
                                >
                                  {/* Left: Resource Title & Key */}
                                  <div className="flex items-center gap-2.5 min-w-[200px]">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                                      allRowEnabled
                                        ? 'bg-emerald-500 ring-2 ring-emerald-200'
                                        : anyRowEnabled
                                          ? 'bg-blue-400'
                                          : 'bg-slate-300'
                                    }`} />
                                    <div>
                                      <p className="text-xs font-bold text-slate-800 leading-tight">{row.label}</p>
                                      <p className="text-[10px] font-mono text-slate-400">{row.key}</p>
                                    </div>
                                  </div>

                                  {/* Middle: 4 Compact Action Pills [+ Create] [👁 Read] [✎ Edit] [🗑 Void] */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {PERMISSION_MATRIX_COLS.map((col) => {
                                      const permKey = `${row.key}:${col.key}`;
                                      const isDeleteRestricted = row.restrictDelete && col.key === 'delete';
                                      const isAllowed = formData.permissions.includes(permKey) || formData.permissions.includes('*') || formData.role === 'admin';

                                      return (
                                        <button
                                          key={col.key}
                                          type="button"
                                          disabled={isDeleteRestricted && !formData.permissions.includes('*') && formData.role !== 'admin'}
                                          onClick={() => toggleMatrixCell(row.key, col.key)}
                                          title={
                                            isDeleteRestricted
                                              ? 'ARC Contract deletion is strictly restricted to Boss / Administrator'
                                              : `${isAllowed ? 'Revoke' : 'Grant'} ${col.label} for ${row.label}`
                                          }
                                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                                            isAllowed
                                              ? col.key === 'delete'
                                                ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200'
                                                : col.key === 'read'
                                                  ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-200'
                                                  : col.key === 'update'
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-200'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200'
                                              : isDeleteRestricted
                                                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                                          }`}
                                        >
                                          <span className="font-mono text-[10px]">{col.short}</span>
                                          <span>{col.label}</span>
                                          {isDeleteRestricted && <Lock size={9} className="text-slate-400" />}
                                        </button>
                                      );
                                    })}

                                    <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                                    {/* Right: Row Quick Toggles */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleRowQuick(row.key, 'all')}
                                        className="px-1.5 py-0.5 text-[9.5px] font-bold text-slate-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                                        title="Enable all permissions for this row"
                                      >
                                        All
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleRowQuick(row.key, 'read')}
                                        className="px-1.5 py-0.5 text-[9.5px] font-bold text-slate-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                                        title="Enable only read for this row"
                                      >
                                        Read
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleRowQuick(row.key, 'clear')}
                                        className="px-1.5 py-0.5 text-[9.5px] font-bold text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                        title="Clear all permissions for this row"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ================================================================
                  SECTION 3: SPECIAL PRIVACY CONTROLS & AUDIT
                  View Pricing, Item Quote History, Inventory Trace History
                 ================================================================ */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/70 shadow-xs">
                <button
                  type="button"
                  onClick={() => setShowAdditionalPrivileges(!showAdditionalPrivileges)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left font-bold text-xs text-slate-800 hover:bg-slate-100/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sliders size={15} className="text-slate-600" />
                    <span className="uppercase tracking-wide">
                      Special Privacy Controls & Audit Trails
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                      {SPECIAL_CAPABILITIES.filter(cap =>
                        formData.permissions.includes(cap.key) || formData.permissions.includes('*') || formData.role === 'admin'
                      ).length} / {SPECIAL_CAPABILITIES.length} Active
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                    <span>{showAdditionalPrivileges ? 'Collapse' : 'Expand'}</span>
                    {showAdditionalPrivileges ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {showAdditionalPrivileges && (
                  <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                    <p className="text-[11px] text-slate-500 font-medium">
                      Control sensitive audit trails, lifecycle histories, and commercial pricing unmasking:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {SPECIAL_CAPABILITIES.map((cap) => {
                        const isAllowed = formData.permissions.includes(cap.key) || formData.permissions.includes('*') || formData.role === 'admin';
                        return (
                          <div
                            key={cap.key}
                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                              isAllowed
                                ? 'bg-gradient-to-r from-indigo-50/60 to-white border-indigo-300 ring-1 ring-indigo-200'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="pr-3">
                              <p className="text-xs font-bold text-slate-800">{cap.label}</p>
                              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{cap.description}</p>
                              <p className="text-[9.5px] font-mono text-slate-400 mt-1">{cap.key}</p>
                            </div>
                            <ToggleSwitch
                              checked={isAllowed}
                              onChange={() => toggleSpecialCapability(cap.key)}
                              label={cap.label}
                              title={`Toggle ${cap.label}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    (!editingId && availabilityState.checked && availabilityState.available === false) ||
                    (editingId && updateUserVerify.verified === false)
                  }
                  className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.9)'}
                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                >
                  {isLoading ? (
                    <><RefreshCw size={14} className="animate-spin" /> Processing...</>
                  ) : editingId ? (
                    <><RefreshCw size={14} /> Save Permissions</>
                  ) : (
                    <><Plus size={14} /> Create User</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
