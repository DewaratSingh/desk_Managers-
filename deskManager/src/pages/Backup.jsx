import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudUpload,
  Database,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Save,
  Play,
  UploadCloud,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  EyeOff,
  Send,
  Cookie,
  UserCheck,
  Info,
  BellRing,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';

export default function Backup() {
  const location = useLocation();

  // Admin One-Time Setup (Client ID & Secret)
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [folderId, setFolderId] = useState('');
  const [isClientKeysConfigured, setIsClientKeysConfigured] = useState(false);
  const [showAdminKeys, setShowAdminKeys] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isSavingAdminKeys, setIsSavingAdminKeys] = useState(false);

  // User Authentication & Cookies state
  const [cookiesInput, setCookiesInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showCookiesDrawer, setShowCookiesDrawer] = useState(false);
  const [isSendingUserAuth, setIsSendingUserAuth] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [accountEmail, setAccountEmail] = useState(null);

  // Backup date & alert threshold state (stored in keys table)
  const [lastBackupDate, setLastBackupDate] = useState(null);
  const [alertIntervalSeconds, setAlertIntervalSeconds] = useState(259200);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Real-time ticker to update live elapsed seconds for testing
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Backup files & execution state
  const [backupDir, setBackupDir] = useState('');
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [backupStatusMsg, setBackupStatusMsg] = useState(null);

  // Listen for popup window message or redirect params
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        toast.success('Google Authentication successful!');
        fetchKeys();
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        toast.error(`Authentication error: ${event.data.error || 'Failed'}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auth_success') === '1') {
      toast.success('Google Drive connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('auth_error')) {
      toast.error(`Google authorization error: ${params.get('auth_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  // Load saved keys from backend
  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/backup/keys');
      if (res.ok) {
        const data = await res.json();
        if (data.keys) {
          setClientId(data.keys.client_id || '');
          setClientSecret(data.keys.client_secret_masked || '');
          setFolderId(data.keys.folder_id || '');
          setCookiesInput(data.keys.cookies || '');
          setIsGoogleConnected(Boolean(data.keys.is_connected));
          setAccountEmail(data.keys.account_email);
          setLastBackupDate(data.keys.last_backup_date || null);
          const rawSec =
            data.keys.alert_interval_seconds !== undefined && data.keys.alert_interval_seconds !== null
              ? data.keys.alert_interval_seconds
              : (data.keys.alert_interval_days ? data.keys.alert_interval_days * 86400 : 259200);
          setAlertIntervalSeconds(rawSec > 0 && rawSec < 86400 ? 259200 : rawSec);
          const hasKeys = Boolean(data.keys.client_id && data.keys.client_secret_masked);
          setIsClientKeysConfigured(hasKeys);
          if (!hasKeys) {
            setShowAdminKeys(true);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching backup keys:', err);
    }
  }, []);

  // Load server backup files
  const fetchBackupFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/backup/files');
      if (res.ok) {
        const data = await res.json();
        setBackupDir(data.backup_dir || '');
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error loading backup files:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
    fetchBackupFiles();
  }, [fetchKeys, fetchBackupFiles]);

  // Format threshold display name
  const formatThresholdName = (seconds) => {
    if (!seconds || seconds <= 0) return 'Disabled';
    const days = Math.max(1, Math.round(seconds / 86400));
    if (days >= 30) return `${Math.round(days / 30)} Month${Math.round(days / 30) > 1 ? 's' : ''}`;
    if (days >= 7 && days % 7 === 0) return `${days / 7} Week${days / 7 > 1 ? 's' : ''}`;
    return `${days} Day${days > 1 ? 's' : ''}`;
  };

  // Save one-time admin client credentials
  const handleSaveAdminKeys = async () => {
    setIsSavingAdminKeys(true);
    try {
      const res = await fetch('/api/backup/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          folder_id: folderId,
          alert_interval_seconds: alertIntervalSeconds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Client credentials saved in keys table!');
        setShowAdminKeys(false);
        await fetchKeys();
        window.dispatchEvent(new Event('backup_status_changed'));
      } else {
        toast.error(data.error || 'Failed to save credentials.');
      }
    } catch (err) {
      toast.error(`Error saving keys: ${err.message}`);
    } finally {
      setIsSavingAdminKeys(false);
    }
  };

  // Update alert threshold in seconds
  const handleAlertThresholdChange = async (seconds) => {
    setAlertIntervalSeconds(seconds);
    setIsUpdatingThreshold(true);
    try {
      const res = await fetch('/api/backup/alert-threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_interval_seconds: seconds }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.info(
          seconds === 0
            ? 'Backup overdue alerts disabled.'
            : `Overdue alert set for backups older than ${formatThresholdName(seconds)}.`
        );
        window.dispatchEvent(new Event('backup_status_changed'));
      } else {
        toast.error(data.error || 'Failed to update alert threshold.');
      }
    } catch (err) {
      toast.error(`Error updating threshold: ${err.message}`);
    } finally {
      setIsUpdatingThreshold(false);
    }
  };

  // User 1-click Google sign in (opens OAuth popup from computer)
  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch('/api/backup/auth-url');
      const data = await res.json();

      if (res.ok && data.auth_url) {
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        const popup = window.open(
          data.auth_url,
          'GoogleAuthPopup',
          `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
        );

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          window.location.href = data.auth_url;
        }
      } else {
        toast.error(data.error || 'Google Client ID is not configured on server yet.');
      }
    } catch (err) {
      toast.error(`Authentication error: ${err.message}`);
    }
  };

  // User sends cookies or manual token directly to server
  const handleSendCookiesToServer = async () => {
    if (!cookiesInput.trim() && !tokenInput.trim()) {
      toast.warning('Please enter session cookies or access token.');
      return;
    }

    setIsSendingUserAuth(true);
    try {
      const res = await fetch('/api/backup/user-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookies: cookiesInput,
          access_token: tokenInput,
          folder_id: folderId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Credentials sent and verified by server!');
        setIsGoogleConnected(Boolean(data.connected));
        if (data.email) setAccountEmail(data.email);
        setShowCookiesDrawer(false);
        await fetchKeys();
      } else {
        toast.error(data.error || data.test_error || 'Server could not verify the provided credentials.');
      }
    } catch (err) {
      toast.error(`Submission error: ${err.message}`);
    } finally {
      setIsSendingUserAuth(false);
    }
  };

  // Take backup on server and upload to Google Drive
  const handleTakeBackup = async () => {
    setIsBackingUp(true);
    setBackupStatusMsg('1/2 Generating PostgreSQL database dump on server...');
    try {
      setTimeout(() => {
        setBackupStatusMsg('2/2 Uploading dump file to Google Drive...');
      }, 1500);

      const res = await fetch('/api/backup/take-backup', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || 'Backup created and uploaded to Google Drive!');
        if (data.last_backup_date) {
          setLastBackupDate(data.last_backup_date);
        }
        await fetchBackupFiles();
        window.dispatchEvent(new Event('backup_status_changed'));
      } else {
        toast.error(data.error || 'Database backup failed on server.');
      }
    } catch (err) {
      toast.error(`Backup error: ${err.message}`);
    } finally {
      setIsBackingUp(false);
      setBackupStatusMsg(null);
    }
  };

  // Upload an existing local backup to Google Drive
  const handleUploadLocal = async (filename) => {
    setUploadingFile(filename);
    try {
      const res = await fetch('/api/backup/upload-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || `Uploaded ${filename} to Google Drive!`);
        if (data.last_backup_date) {
          setLastBackupDate(data.last_backup_date);
        }
        window.dispatchEvent(new Event('backup_status_changed'));
      } else {
        toast.error(data.error || `Upload failed for ${filename}`);
      }
    } catch (err) {
      toast.error(`Upload error: ${err.message}`);
    } finally {
      setUploadingFile(null);
    }
  };

  // Overdue calculation (evaluated live every second)
  const calculateOverdue = () => {
    if (alertIntervalSeconds === 0) {
      return { isOverdue: false, never: false, elapsedSeconds: 0, text: 'Alerts disabled' };
    }
    if (!lastBackupDate) {
      return { isOverdue: true, never: true, elapsedSeconds: 999999, text: 'No backup recorded yet' };
    }
    const diffMs = now - new Date(lastBackupDate).getTime();
    const elapsedSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    const elapsedHours = Math.floor(elapsedSeconds / 3600);
    const elapsedDays = Math.floor(elapsedSeconds / 86400);

    let timeAgo = '';
    if (elapsedDays > 0) {
      timeAgo = `${elapsedDays} day${elapsedDays > 1 ? 's' : ''} ago`;
    } else if (elapsedHours > 0) {
      timeAgo = `${elapsedHours} hour${elapsedHours > 1 ? 's' : ''} ago`;
    } else if (elapsedMinutes > 0) {
      timeAgo = `${elapsedMinutes} min ${elapsedSeconds % 60}s ago`;
    } else {
      timeAgo = `${elapsedSeconds} second${elapsedSeconds !== 1 ? 's' : ''} ago`;
    }

    return {
      isOverdue: elapsedSeconds >= alertIntervalSeconds,
      never: false,
      elapsedSeconds,
      timeAgo,
      formattedDate: new Date(lastBackupDate).toLocaleString(),
    };
  };

  const overdue = calculateOverdue();

  return (
    <div className="flex-1 p-6 bg-[var(--bg-app)] text-slate-900 min-h-screen transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--theme-primary)] text-white shadow-md">
              <CloudUpload size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 m-0 tracking-tight">Cloud Backup</h1>
                {isGoogleConnected ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Google Connected
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <AlertTriangle size={12} /> Sign-in Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Log in via Google from your computer to trigger server database dumps and automatic Drive uploads.
              </p>
            </div>
          </div>

          {accountEmail && (
            <div className="text-right hidden sm:block bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Connected Account</span>
              <span className="text-xs font-bold text-slate-700 font-mono">{accountEmail}</span>
            </div>
          )}
        </div>

        {/* PROMINENT OVERDUE ALERT BANNER */}
        {overdue.isOverdue && (
          <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl border border-red-200 shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-red-900 m-0 flex items-center gap-2">
                  <span>Backup Overdue Warning</span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-red-200 text-red-800 rounded font-black">
                    Action Needed
                  </span>
                </h3>
                <p className="text-xs text-red-700 mt-1 font-medium leading-relaxed">
                  {overdue.never ? (
                    <span>No database backup has ever been recorded on this system.</span>
                  ) : (
                    <span>
                      Your last backup was taken on <strong>{overdue.formattedDate}</strong> ({overdue.timeAgo}).
                      This exceeds your configured reminder alert threshold of <strong>{formatThresholdName(alertIntervalSeconds)}</strong>.
                    </span>
                  )}
                  {' '}Please take a backup now to prevent data loss.
                </p>
              </div>
            </div>

            <button
              onClick={handleTakeBackup}
              disabled={isBackingUp}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0 self-stretch sm:self-auto flex items-center justify-center gap-1.5"
            >
              {isBackingUp ? <RotateCw size={14} className="animate-spin" /> : <Play size={14} />}
              <span>Backup Database Now</span>
            </button>
          </div>
        )}

        {/* HEALTHY STATUS BANNER (when not overdue) */}
        {!overdue.isOverdue && lastBackupDate && (
          <div className="bg-emerald-50/80 border border-emerald-300 text-emerald-900 rounded-xl p-3 shadow-xs flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>
                <strong>Backup Up to Date:</strong> Last successful backup occurred on <strong>{overdue.formattedDate}</strong> ({overdue.timeAgo}).
              </span>
            </div>
            {alertIntervalSeconds > 0 && (
              <span className="text-[11px] text-emerald-700 font-semibold hidden md:inline-block">
                Reminder active ({formatThresholdName(alertIntervalSeconds)} threshold)
              </span>
            )}
          </div>
        )}

        {/* BACKUP SCHEDULE & ALERT THRESHOLD SELECTOR */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600 border border-violet-200">
              <BellRing size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Backup Reminder &amp; Alert Threshold
                </span>
                {isUpdatingThreshold && (
                  <span className="text-[10px] text-violet-600 font-bold flex items-center gap-1">
                    <RotateCw size={10} className="animate-spin" /> Updating...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically alerts you on this page when the last backup date exceeds your chosen timeframe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-600 shrink-0">Alert if older than:</span>
            <select
              value={alertIntervalSeconds}
              onChange={(e) => handleAlertThresholdChange(Number(e.target.value))}
              disabled={isUpdatingThreshold}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-violet-500 cursor-pointer shadow-xs"
            >
              <option value={86400}>1 Day (Daily)</option>
              <option value={172800}>2 Days</option>
              <option value={259200}>3 Days (Default)</option>
              <option value={432000}>5 Days</option>
              <option value={604800}>7 Days (1 Week)</option>
              <option value={1209600}>14 Days (2 Weeks)</option>
              <option value={2592000}>30 Days (1 Month)</option>
              <option value={0}>Disabled (No Alerts)</option>
            </select>
          </div>
        </div>

        {/* SECTION 1: One-Time Client Credentials Status Bar */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${isClientKeysConfigured ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                <Key size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Google Cloud App Credentials
                  </span>
                  {isClientKeysConfigured ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Configured in database (Once) ✓
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Setup Required Once
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Client ID &amp; Secret are stored permanently in the server&apos;s <code>keys</code> table.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdminKeys(!showAdminKeys)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Settings size={13} />
              <span>{showAdminKeys ? 'Hide Credentials' : isClientKeysConfigured ? 'Change Credentials' : 'Configure Credentials'}</span>
              {showAdminKeys ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {/* Collapsible Admin Form */}
          {showAdminKeys && (
            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">Google Cloud Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. 123456789-abcdefg.apps.googleusercontent.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase">Google Cloud Client Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="e.g. GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 pr-9 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 uppercase">Target Google Drive Folder ID (Optional)</label>
                <input
                  type="text"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  placeholder="e.g. 1a2b3c4d5e6f7g8h9 (Leave blank for Root Drive)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2 flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveAdminKeys}
                  disabled={isSavingAdminKeys}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{isSavingAdminKeys ? 'Saving to Database...' : 'Save Credentials Once'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: User Google Authentication & Cookies */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 m-0">User Google Authentication</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in with Google or send session cookies to authorize server uploads.
                </p>
              </div>
            </div>

            {/* Authentication Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <UserCheck size={14} />
                <span>{isGoogleConnected ? 'Switch / Reconnect Google' : 'Sign in with Google'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCookiesDrawer(!showCookiesDrawer)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title="Send session cookies or auth header"
              >
                <Cookie size={14} />
                <span>Cookies / Token</span>
                {showCookiesDrawer ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          </div>

          {/* Cookies / Manual Token Adder */}
          {showCookiesDrawer && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Google Session Cookies / Auth Header:
                </label>
                <textarea
                  rows={2}
                  value={cookiesInput}
                  onChange={(e) => setCookiesInput(e.target.value)}
                  placeholder="Paste cookies (e.g. SID=...; HSID=...) or session auth header provided by Google"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Optional Access Token:
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste ya29... token (if using manual token)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSendCookiesToServer}
                  disabled={isSendingUserAuth}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{isSendingUserAuth ? 'Sending & Verifying...' : 'Send Cookies to Server'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Main Action Card: Take Server Backup & Upload */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
              <Database size={20} className="text-blue-600" />
              <span>Create Server Backup &amp; Upload to Google Drive</span>
            </div>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Dumps the complete PostgreSQL database on the server machine via <code>pg_dump</code> and immediately uploads the dump file to your Google Drive account.
            </p>
            {backupStatusMsg && (
              <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-md border border-blue-200 mt-2">
                <RotateCw size={13} className="animate-spin" />
                <span>{backupStatusMsg}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleTakeBackup}
            disabled={isBackingUp}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-extrabold text-sm text-white shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
            style={{ backgroundColor: 'var(--theme-secondary)' }}
          >
            {isBackingUp ? (
              <>
                <RotateCw size={16} className="animate-spin" />
                <span>Processing Backup...</span>
              </>
            ) : (
              <>
                <UploadCloud size={18} />
                <span>Take Backup Now</span>
              </>
            )}
          </button>
        </div>

        {/* SECTION 4: Local Server Backup Files List */}
        <div className="bg-[var(--bg-form)] border border-slate-300 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                <FileText size={16} />
              </div>
              <h2 className="text-base font-bold text-slate-800 m-0">Server Backup Dumps</h2>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {files.length}
              </span>
            </div>

            <button
              onClick={fetchBackupFiles}
              disabled={loadingFiles}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCw size={12} className={loadingFiles ? 'animate-spin text-blue-600' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingFiles ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <RotateCw size={24} className="animate-spin text-blue-600" />
              <p className="text-sm font-semibold">Scanning server backup folder...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Database size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Server Backups Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No backup dump files exist yet in the server directory. Click &quot;Take Backup Now&quot; above to create one.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Backup Dump File</th>
                    <th className="py-3 px-4">File Size</th>
                    <th className="py-3 px-4">Generated Date</th>
                    <th className="py-3 px-4 text-right">Upload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {files.map((file) => {
                    const isUploading = uploadingFile === file.filename;
                    return (
                      <tr key={file.filename} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {file.filename}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">
                          {file.size_formatted}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(file.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleUploadLocal(file.filename)}
                            disabled={Boolean(isUploading) || !isGoogleConnected}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
                            title={isGoogleConnected ? 'Upload this backup file to Google Drive' : 'Sign in with Google first'}
                          >
                            <UploadCloud size={13} className={isUploading ? 'animate-bounce' : ''} />
                            <span>{isUploading ? 'Uploading...' : 'Upload to Drive'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Helpful Info Note */}
        <div className="p-4 bg-slate-100/80 border border-slate-300 rounded-xl text-slate-600 text-xs flex items-center gap-2.5">
          <Info size={16} className="text-slate-500 shrink-0" />
          <span>
            Database dumps are created via PostgreSQL <code>pg_dump</code> on the server machine. When Google credentials are configured in the <code>keys</code> table, dumps upload directly to your Google Drive.
          </span>
        </div>

      </div>
    </div>
  );
}
