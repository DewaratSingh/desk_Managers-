import { useState, useEffect } from 'react';
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
  Database
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  PERMISSION_MATRIX_ROWS,
  PERMISSION_MATRIX_COLS
} from '../utils/permissions';

const EMPTY_FORM = {
  username: '',
  permissions: []
};

// Additional general system privileges that live outside the 8-row operations matrix
const ADDITIONAL_SYSTEM_PERMISSIONS = [
  { value: 'view_dashboard', label: 'View Main Dashboard & Trades', description: 'Access to system overview and trades listing' },
  { value: 'manage_inventory', label: 'Manage Inventory Stock', description: 'Stock tracking, adjustments, and inventory views' },
  { value: 'manage_items', label: 'Manage Catalog Items', description: 'Catalog items, specifications, and SKU definitions' },
  { value: 'manage_parties', label: 'Manage Parties (Customers)', description: 'Customer directories and company parties' },
  { value: 'manage_contacts', label: 'Manage Contacts (Buyers)', description: 'Buyer records and contact individuals' },
  { value: 'manage_arc', label: 'Manage ARC Contracts', description: 'Annual rate contracts and agreements' },
  { value: 'manage_gst', label: 'Manage GST Categories', description: 'Tax categories and GST configuration' },
  { value: 'view_history', label: 'View Item Quote & Stock History', description: 'Price and quotation audit trail' },
  { value: 'view_pricing', label: 'View Pricing & Financial Details', description: 'Financial values, rates, and unit pricing' },
  { value: 'manage_users', label: 'Manage Users & System Settings', description: 'Operator management and tenant preferences' }
];

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
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
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

  // Additional privileges collapsible section toggle
  const [showAdditionalPrivileges, setShowAdditionalPrivileges] = useState(false);

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
        setEditingId(u.username);
        setFormData({
          username: u.username || '',
          permissions: Array.isArray(u.permissions) ? u.permissions : []
        });
      } else {
        setEditingId(null);
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
            permissions: formData.permissions
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

  // Matrix cell toggle
  const toggleMatrixCell = (rowKey, colKey) => {
    const permKey = `${rowKey}:${colKey}`;
    const currentList = [...formData.permissions];
    const index = currentList.indexOf(permKey);
    if (index > -1) {
      currentList.splice(index, 1);
    } else {
      currentList.push(permKey);
    }
    setFormData({ ...formData, permissions: currentList });
  };

  // Row toggle (all columns for a row)
  const toggleRow = (rowKey) => {
    const rowPerms = PERMISSION_MATRIX_COLS.map(c => `${rowKey}:${c.key}`);
    const allEnabled = rowPerms.every(p => formData.permissions.includes(p));

    let currentList = [...formData.permissions];
    if (allEnabled) {
      currentList = currentList.filter(p => !rowPerms.includes(p));
    } else {
      rowPerms.forEach(p => {
        if (!currentList.includes(p)) currentList.push(p);
      });
    }
    setFormData({ ...formData, permissions: currentList });
  };

  // Column toggle (all rows for a column)
  const toggleColumn = (colKey) => {
    const colPerms = PERMISSION_MATRIX_ROWS.map(r => `${r.key}:${colKey}`);
    const allEnabled = colPerms.every(p => formData.permissions.includes(p));

    let currentList = [...formData.permissions];
    if (allEnabled) {
      currentList = currentList.filter(p => !colPerms.includes(p));
    } else {
      colPerms.forEach(p => {
        if (!currentList.includes(p)) currentList.push(p);
      });
    }
    setFormData({ ...formData, permissions: currentList });
  };

  // Quick matrix bulk actions
  const enableAllMatrix = () => {
    const allMatrixPerms = [];
    PERMISSION_MATRIX_ROWS.forEach(r => {
      PERMISSION_MATRIX_COLS.forEach(c => {
        allMatrixPerms.push(`${r.key}:${c.key}`);
      });
    });
    const merged = Array.from(new Set([...formData.permissions, ...allMatrixPerms]));
    setFormData({ ...formData, permissions: merged });
  };

  const disableAllMatrix = () => {
    const allMatrixPerms = new Set();
    PERMISSION_MATRIX_ROWS.forEach(r => {
      PERMISSION_MATRIX_COLS.forEach(c => {
        allMatrixPerms.add(`${r.key}:${c.key}`);
      });
    });
    const filtered = formData.permissions.filter(p => !allMatrixPerms.has(p));
    setFormData({ ...formData, permissions: filtered });
  };

  const enableReadOnlyMatrix = () => {
    const readPerms = PERMISSION_MATRIX_ROWS.map(r => `${r.key}:read`);
    const writePerms = new Set();
    PERMISSION_MATRIX_ROWS.forEach(r => {
      writePerms.add(`${r.key}:create`);
      writePerms.add(`${r.key}:update`);
    });
    const filtered = formData.permissions.filter(p => !writePerms.has(p));
    const merged = Array.from(new Set([...filtered, ...readPerms]));
    setFormData({ ...formData, permissions: merged });
  };

  // Additional system permissions toggle
  const toggleAdditionalPermission = (permValue) => {
    const currentList = [...formData.permissions];
    const index = currentList.indexOf(permValue);
    if (index > -1) {
      currentList.splice(index, 1);
    } else {
      currentList.push(permValue);
    }
    setFormData({ ...formData, permissions: currentList });
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.company_name && u.company_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Count active matrix permissions
  const activeMatrixCount = PERMISSION_MATRIX_ROWS.reduce((acc, r) => {
    const count = PERMISSION_MATRIX_COLS.filter(c =>
      formData.permissions.includes(`${r.key}:${c.key}`)
    ).length;
    return acc + count;
  }, 0);
  const totalMatrixCells = PERMISSION_MATRIX_ROWS.length * PERMISSION_MATRIX_COLS.length;

  // Format permission badges for list view
  const renderPermissionsBadge = (u) => {
    const r = (u.role || '').toLowerCase();
    if (r === 'admin' || r === 'owner' || !u.permissions || u.permissions.length === 0) {
      return (
        <span className="px-2.5 py-0.5 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full inline-flex items-center gap-1 shadow-sm">
          <ShieldAlert size={10} className="text-emerald-600" />
          Full Permissions (Owner / Admin)
        </span>
      );
    }

    const perms = Array.isArray(u.permissions) ? u.permissions : [];

    // Group matrix permissions
    const matrixBadges = [];
    PERMISSION_MATRIX_ROWS.forEach(row => {
      const grantedActions = [];
      if (perms.includes(`${row.key}:create`)) grantedActions.push('C');
      if (perms.includes(`${row.key}:read`)) grantedActions.push('R');
      if (perms.includes(`${row.key}:update`)) grantedActions.push('U');

      if (grantedActions.length > 0) {
        matrixBadges.push({
          label: row.label,
          actions: grantedActions.join(',')
        });
      }
    });

    // Additional permissions
    const extraBadges = perms
      .filter(p => !p.includes(':'))
      .map(p => {
        const found = ADDITIONAL_SYSTEM_PERMISSIONS.find(item => item.value === p);
        return found ? found.label : p;
      });

    return (
      <div className="flex flex-wrap gap-1 max-w-md">
        {matrixBadges.map(item => (
          <span
            key={item.label}
            className="px-2 py-0.5 text-[9px] font-bold text-slate-700 bg-emerald-50 border border-emerald-200 rounded-md inline-flex items-center gap-1"
          >
            <span className="font-semibold text-slate-800">{item.label}</span>
            <span className="bg-emerald-600 text-white px-1 py-0.2 rounded text-[8px] font-mono">
              {item.actions}
            </span>
          </span>
        ))}
        {extraBadges.map(label => (
          <span
            key={label}
            className="px-2 py-0.5 text-[9px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-md"
          >
            {label}
          </span>
        ))}
      </div>
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
                Manage operator accounts and granular matrix access permissions (Create, Read, Update).
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
            className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm transition-colors"
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
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
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
              <div className="overflow-x-auto bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-5 py-3">Username</th>
                      <th className="px-5 py-3">Company ID</th>
                      <th className="px-5 py-3">Company Name</th>
                      <th className="px-5 py-3">Permissions Scope (Matrix & System)</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
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
                            className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded font-semibold bg-white text-slate-700 hover:border-slate-800 transition-all inline-flex items-center gap-1 cursor-pointer"
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
                Configure module privileges across Create, Read, and Update actions.
              </p>
            </div>
            {editingId && (
              <span className="px-3 py-1 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Database size={13} /> Edit Mode
              </span>
            )}
          </div>

          <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
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
                    className="w-full px-3.5 py-2.5 bg-white disabled:bg-slate-100 disabled:text-slate-500 border border-slate-300 rounded-lg text-sm placeholder:text-slate-400 font-semibold focus:outline-none transition-all pr-10"
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
                  PERMISSION MATRIX TABLE
                  Rows: Sell RFQ, Sell Quotation, Sell PO, RO, Buy RQ,
                        Buy Contract Order, Process RQ, Process Order
                  Columns: Create, Read, Update
                 ================================================================ */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Operations Permission Matrix
                      </label>
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {activeMatrixCount} / {totalMatrixCells} Active
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Toggle specific permissions for Create, Read, and Update operations.
                    </p>
                  </div>

                  {/* Matrix Quick Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={enableAllMatrix}
                      className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      Enable All
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
                      onClick={disableAllMatrix}
                      className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* The Matrix Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-100/90 border-b border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider">
                          <th className="px-4 py-3 min-w-[200px]">
                            <span className="flex items-center gap-1.5">
                              <Layers size={14} style={{ color: 'var(--theme-color)' }} />
                              Operations / Module
                            </span>
                          </th>
                          {PERMISSION_MATRIX_COLS.map((col) => (
                            <th key={col.key} className="px-4 py-3 text-center min-w-[110px]">
                              <div className="flex flex-col items-center gap-1">
                                <span>{col.label}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleColumn(col.key)}
                                  className="text-[9px] font-bold text-slate-500 hover:text-slate-900 underline decoration-dotted cursor-pointer lowercase"
                                  title={`Toggle all ${col.label} permissions`}
                                >
                                  toggle all
                                </button>
                              </div>
                            </th>
                          ))}
                          <th className="px-3 py-3 text-right text-[10px] font-semibold text-slate-400">
                            Row Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white text-xs">
                        {PERMISSION_MATRIX_ROWS.map((row) => {
                          const rowPerms = PERMISSION_MATRIX_COLS.map(c => `${row.key}:${c.key}`);
                          const allRowEnabled = rowPerms.every(p => formData.permissions.includes(p));
                          const anyRowEnabled = rowPerms.some(p => formData.permissions.includes(p));

                          return (
                            <tr
                              key={row.key}
                              className={`transition-colors hover:bg-slate-50/80 ${
                                anyRowEnabled ? 'bg-slate-50/40' : ''
                              }`}
                            >
                              {/* Row Module Label */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    allRowEnabled
                                      ? 'bg-emerald-500 ring-2 ring-emerald-200'
                                      : anyRowEnabled
                                        ? 'bg-blue-400'
                                        : 'bg-slate-300'
                                  }`} />
                                  <div>
                                    <p className="font-bold text-slate-900 text-xs">{row.label}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      id: {row.key}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Matrix Cells: Create, Read, Update */}
                              {PERMISSION_MATRIX_COLS.map((col) => {
                                const permKey = `${row.key}:${col.key}`;
                                const isAllowed = formData.permissions.includes(permKey);

                                return (
                                  <td
                                    key={col.key}
                                    className="px-4 py-3 text-center align-middle"
                                  >
                                    <div className="flex justify-center items-center">
                                      <ToggleSwitch
                                        checked={isAllowed}
                                        onChange={() => toggleMatrixCell(row.key, col.key)}
                                        label={`${row.label} ${col.label}`}
                                        title={`${isAllowed ? 'Revoke' : 'Grant'} ${col.label} for ${row.label}`}
                                      />
                                    </div>
                                  </td>
                                );
                              })}

                              {/* Row Quick Toggle */}
                              <td className="px-3 py-3 text-right align-middle">
                                <button
                                  type="button"
                                  onClick={() => toggleRow(row.key)}
                                  className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                                    allRowEnabled
                                      ? 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  }`}
                                  title={`Toggle all actions for ${row.label}`}
                                >
                                  {allRowEnabled ? 'Clear Row' : 'Allow Row'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================================================================
                  COLLAPSIBLE ADDITIONAL SYSTEM PRIVILEGES
                  Inventory, Catalog Items, Parties, Contacts, ARC, GST, Pricing
                 ================================================================ */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setShowAdditionalPrivileges(!showAdditionalPrivileges)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left font-bold text-xs text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-slate-500" />
                    <span>Additional System Privileges (Inventory, Catalog, Parties, Settings)</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      ({ADDITIONAL_SYSTEM_PERMISSIONS.filter(p => formData.permissions.includes(p.value)).length} active)
                    </span>
                  </div>
                  {showAdditionalPrivileges ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdditionalPrivileges && (
                  <div className="p-4 border-t border-slate-200 bg-white space-y-2.5">
                    <p className="text-[11px] text-slate-500 mb-2">
                      Enable general administrative and view access to catalog records, pricing details, and auxiliary features:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {ADDITIONAL_SYSTEM_PERMISSIONS.map((perm) => {
                        const isAllowed = formData.permissions.includes(perm.value);
                        return (
                          <div
                            key={perm.value}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                              isAllowed
                                ? 'bg-emerald-50/50 border-emerald-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="pr-2">
                              <p className="text-xs font-bold text-slate-800">{perm.label}</p>
                              <p className="text-[10px] text-slate-400 leading-tight">{perm.description}</p>
                            </div>
                            <ToggleSwitch
                              checked={isAllowed}
                              onChange={() => toggleAdditionalPermission(perm.value)}
                              label={perm.label}
                              title={`Toggle ${perm.label}`}
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
