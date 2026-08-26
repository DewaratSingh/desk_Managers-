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
  ShieldAlert
} from 'lucide-react';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
  username: '',
  permissions: []
};

const AVAILABLE_PERMISSIONS = [
  { value: 'manage_rfqs', label: 'Manage RFQs' },
  { value: 'manage_quotations', label: 'Manage Quotations' },
  { value: 'manage_orders', label: 'Manage Orders (PO/RO)' },
  { value: 'manage_inventory', label: 'Manage Inventory' },
  { value: 'manage_users', label: 'Manage Users' }
];

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
        // Create user (password defaults to username in the backend)
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.username,
            permissions: formData.permissions
          })
        });
        if (res.ok) {
          toast.success('User added successfully!');
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

  const togglePermission = (permValue) => {
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

  const renderPermissionsBadge = (u) => {
    if (u.role === 'admin' || !u.permissions || u.permissions.length === 0) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-black text-red-700 bg-red-50 border border-red-200 rounded-full inline-flex items-center gap-1 shadow-sm">
          <ShieldAlert size={10} />
          Full Permissions
        </span>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {u.permissions.map((perm) => {
          const config = AVAILABLE_PERMISSIONS.find(p => p.value === perm);
          return (
            <span key={perm} className="px-2 py-0.5 text-[9px] font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-md">
              {config ? config.label : perm}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 bg-slate-100 text-slate-900">
      {viewMode === 'list' ? (
        <div className="max-w-5xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-300">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 m-0">User Accounts</h1>
              <p className="text-xs text-slate-500 mt-1">
                Manage operator accounts and granular file access permissions.
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
                      <th className="px-5 py-3">Permissions Scope</th>
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
                        <td className="px-5 py-3.5 max-w-xs">
                          {renderPermissionsBadge(u)}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
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
            VIEW MODE: FULL PAGE FORM
           ================================================================ */
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Header with Back */}
          <button
            onClick={() => navigate(-1)}
            className="mb-3 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-colors self-start shadow-sm"
          >
            <ArrowLeft size={14} />
            Back to Users Directory
          </button>
          <h1 className="text-2xl font-bold text-slate-900 m-0">
            {editingId ? `Update Permissions for: ${editingId}` : 'Add New User'}
          </h1>

          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
            <form onSubmit={handleAddUser} className="space-y-4">
              
              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  placeholder="e.g. jsmith"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-300 rounded text-sm placeholder:text-slate-400 font-medium focus:outline-none"
                  onFocus={(e) => !editingId && (e.target.style.borderColor = 'var(--theme-color)')}
                  onBlur={(e) => !editingId && (e.target.style.borderColor = 'rgb(203, 213, 225)')}
                />
              </div>

              {/* Permissions Checklist */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Access Permissions Scope
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <p className="text-[11px] text-slate-400 font-semibold mb-2">Select files and features this operator can manage:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AVAILABLE_PERMISSIONS.map((perm) => {
                      const isChecked = formData.permissions.includes(perm.value);
                      return (
                        <label
                          key={perm.value}
                          className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer text-xs font-semibold text-slate-700 transition-colors select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(perm.value)}
                            className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                          />
                          <span>{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-5 py-2.5 border border-slate-300 rounded text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded text-sm font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
