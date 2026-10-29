let selectedBackup = null;
let currentBackupPath = "";
let currentLocalFiles = [];
let currentAuthMode = "oauth";
let currentNetworkInfo = { ipv4: "127.0.0.1", hostname: "DESKTOP", url: "http://127.0.0.1:5000" };

let appInitialized = false;

async function checkAndInitApp() {
  if (appInitialized) return;
  if (window.pywebview && window.pywebview.api) {
    appInitialized = true;
    await initApp();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkAndInitApp();

  window.addEventListener("pywebviewready", () => {
    checkAndInitApp();
  });

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (window.pywebview && window.pywebview.api) {
      checkAndInitApp();
      clearInterval(interval);
    } else if (attempts > 50) {
      clearInterval(interval);
    }
  }, 100);
});

async function initApp() {
  await loadBackupConfig();
  await loadGDriveConfig();
  await loadFullConfigToSettings();
  await loadBackupFiles();
  await loadCloudHistory();
  await loadNetworkInfo();
  await loadPM2Status();
}

function switchTab(tabId) {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));

  const navBtn = document.getElementById(`nav-${tabId}`);
  const panel = document.getElementById(`panel-${tabId}`);

  if (navBtn && panel) {
    navBtn.classList.add("active");
    panel.classList.add("active");
  }

  if (tabId === 'dashboard') {
    stopPM2Polling();
    loadNetworkInfo();
  } else if (tabId === 'autostart') {
    loadPM2Status();
    loadPM2Logs();
    startPM2Polling();
  } else {
    stopPM2Polling();
  }
}

function setAuthMode(mode) {
  currentAuthMode = mode;
  document.querySelectorAll(".auth-tab-btn").forEach(btn => btn.classList.remove("active"));
  
  const oauthFields = document.getElementById("oauthFields");
  const tokenFields = document.getElementById("tokenFields");
  const btnAuth = document.getElementById("btnAuthorizeOAuth");

  if (mode === 'oauth') {
    document.getElementById("tabOAuthMode").classList.add("active");
    oauthFields.classList.remove("hidden");
    tokenFields.classList.add("hidden");
    if (btnAuth) btnAuth.style.display = "inline-flex";
  } else {
    document.getElementById("tabTokenMode").classList.add("active");
    oauthFields.classList.add("hidden");
    tokenFields.classList.remove("hidden");
    if (btnAuth) btnAuth.style.display = "none";
  }
}

async function loadNetworkInfo() {
  try {
    if (window.pywebview && window.pywebview.api) {
      currentNetworkInfo = await window.pywebview.api.get_network_info();
    } else {
      currentNetworkInfo = {
        ipv4: "192.168.1.105",
        hostname: "DESKTOP-PC",
        url: "http://192.168.1.105:5000"
      };
    }

    const statIp = document.getElementById("statIpv4Address");
    const statHost = document.getElementById("statHostname");
    const ipVal = document.getElementById("ipValueText");
    const ipUrl = document.getElementById("ipUrlText");
    const qrImg = document.getElementById("qrCodeImg");

    if (statIp) statIp.textContent = currentNetworkInfo.ipv4;
    if (statHost) statHost.textContent = `Host: ${currentNetworkInfo.hostname}`;
    if (ipVal) ipVal.textContent = currentNetworkInfo.ipv4;
    if (ipUrl) ipUrl.textContent = currentNetworkInfo.url;

    if (qrImg) {
      const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentNetworkInfo.url)}`;
      qrImg.src = qrDataUrl;
    }
  } catch (err) {
    console.error("Error loading network info:", err);
  }
}

function copyIpv4Address() {
  if (currentNetworkInfo && currentNetworkInfo.ipv4) {
    navigator.clipboard.writeText(currentNetworkInfo.ipv4).then(() => {
      showToast(`Copied IPv4 (${currentNetworkInfo.ipv4}) to clipboard!`, "success");
    }).catch(() => {
      showToast(`IPv4 Address: ${currentNetworkInfo.ipv4}`, "info");
    });
  }
}

async function loadBackupConfig() {
  try {
    if (window.pywebview && window.pywebview.api) {
      const config = await window.pywebview.api.get_backup_config();
      currentBackupPath = config.backup_dir;
      document.getElementById("backupPathInput").value = currentBackupPath;
      const subEl = document.getElementById("statBackupSub");
      if (subEl) subEl.textContent = `In ${currentBackupPath}`;
    }
  } catch (err) {
    console.error("Error loading config:", err);
  }
}

async function loadGDriveConfig() {
  try {
    if (window.pywebview && window.pywebview.api) {
      const gconfig = await window.pywebview.api.get_gdrive_config();
      if (gconfig) {
        const clientIdEl = document.getElementById("gdriveClientIdInput");
        const clientSecretEl = document.getElementById("gdriveClientSecretInput");
        const tokenEl = document.getElementById("gdriveTokenInput");
        const folderEl = document.getElementById("gdriveFolderInput");
        const cookiesEl = document.getElementById("gdriveCookiesInput");

        if (clientIdEl) clientIdEl.value = gconfig.client_id || "";
        if (clientSecretEl) clientSecretEl.value = gconfig.client_secret || "";
        if (tokenEl) tokenEl.value = gconfig.access_token || "";
        if (folderEl) folderEl.value = gconfig.folder_id || "";
        if (cookiesEl) cookiesEl.value = gconfig.cookies || "";

        updateGDriveBadge(!!gconfig.refresh_token || !!gconfig.access_token, !!gconfig.refresh_token);
      }
    }
  } catch (err) {
    console.error("Error loading GDrive config:", err);
  }
}

async function loadFullConfigToSettings() {
  try {
    if (window.pywebview && window.pywebview.api) {
      const fullConfig = await window.pywebview.api.get_full_config();
      if (fullConfig) {
        const backupDirEl = document.getElementById("settingBackupDirInput");
        const hostEl = document.getElementById("settingHostInput");
        const portEl = document.getElementById("settingPortInput");
        const retentionEl = document.getElementById("settingRetentionInput");

        if (backupDirEl) backupDirEl.value = fullConfig.backup_dir || fullConfig.selected_location?.backup_dir || "";
        if (hostEl) hostEl.value = fullConfig.server_settings?.host || "127.0.0.1";
        if (portEl) portEl.value = fullConfig.server_settings?.port || 5000;
        if (retentionEl) retentionEl.value = fullConfig.app_settings?.backup_retention_days || 4;
      }
    }
  } catch (err) {
    console.error("Error loading full config to settings:", err);
  }
}

async function saveSettingsTabConfig() {
  const backupDir = document.getElementById("settingBackupDirInput")?.value.trim();
  const host = document.getElementById("settingHostInput")?.value.trim();
  const port = parseInt(document.getElementById("settingPortInput")?.value.trim() || "5000", 10);
  const retention = parseInt(document.getElementById("settingRetentionInput")?.value.trim() || "4", 10);

  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.save_full_config({
        backup_dir: backupDir,
        selected_location: { backup_dir: backupDir },
        server_settings: { host, port, auto_start: true },
        app_settings: { backup_retention_days: retention }
      });
      if (res && res.success) {
        showToast("Settings successfully saved to config.json!", "success");
        await loadBackupConfig();
        await loadBackupFiles();
      }
    }
  } catch (err) {
    showToast(`Failed to save settings: ${err}`, "danger");
  }
}

function updateGDriveBadge(configured, isPermanent = false) {
  const badge = document.getElementById("gdriveStatusBadge");
  if (configured) {
    badge.className = "badge badge-connected";
    badge.textContent = isPermanent ? "● Permanent Auto-Sync Active" : "● API Configured";
  } else {
    badge.className = "badge badge-disconnected";
    badge.textContent = "● Not Configured";
  }
}

async function saveGDriveCredentials() {
  const clientId = document.getElementById("gdriveClientIdInput") ? document.getElementById("gdriveClientIdInput").value.trim() : "";
  const clientSecret = document.getElementById("gdriveClientSecretInput") ? document.getElementById("gdriveClientSecretInput").value.trim() : "";
  const token = document.getElementById("gdriveTokenInput") ? document.getElementById("gdriveTokenInput").value.trim() : "";
  const folder = document.getElementById("gdriveFolderInput") ? document.getElementById("gdriveFolderInput").value.trim() : "";
  const cookies = document.getElementById("gdriveCookiesInput") ? document.getElementById("gdriveCookiesInput").value.trim() : "";

  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.save_gdrive_config({
        client_id: clientId,
        client_secret: clientSecret,
        access_token: token,
        folder_id: folder,
        cookies: cookies
      });
      if (res && res.success) {
        showToast("Google Drive API credentials & cookies saved to config.json!", "success");
        await loadGDriveConfig();
      }
    }
  } catch (err) {
    showToast(`Failed to save credentials: ${err}`, "danger");
  }
}

async function authorizePermanentGoogleDrive() {
  const clientId = document.getElementById("gdriveClientIdInput").value.trim();
  const clientSecret = document.getElementById("gdriveClientSecretInput").value.trim();
  const folder = document.getElementById("gdriveFolderInput").value.trim();

  if (!clientId || !clientSecret) {
    showToast("Please enter your Google Cloud Client ID and Client Secret first.", "warning");
    return;
  }

  showToast("Opening Google Sign-In in your browser...", "info");

  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.authorize_google_drive(clientId, clientSecret, folder);
      if (res && res.success) {
        updateGDriveBadge(true, true);
        showToast(`Google Drive connected permanently! Refresh Token saved.`, "success");
      } else {
        showToast(`Authorization failed: ${res.error || 'User cancelled login'}`, "danger");
      }
    }
  } catch (err) {
    showToast(`Auth failed: ${err}`, "danger");
  }
}

async function testGDriveConnection() {
  showToast("Testing Google Drive API connection...", "info");
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.test_gdrive_connection();
      if (res && res.success) {
        showToast(`Google Drive Connected! Account: ${res.user_email || 'Verified'}`, "success");
        updateGDriveBadge(true, res.is_permanent);
      } else {
        showToast(`Connection failed: ${res.error || 'Invalid Credentials'}`, "danger");
      }
    }
  } catch (err) {
    showToast(`Test failed: ${err}`, "danger");
  }
}

async function loadBackupFiles() {
  const tableBody = document.getElementById("backupTableBody");
  tableBody.innerHTML = `<tr><td colspan="4" class="text-center loading-cell">Loading backup files...</td></tr>`;
  selectedBackup = null;

  try {
    if (window.pywebview && window.pywebview.api) {
      currentLocalFiles = await window.pywebview.api.get_backup_files();
    } else {
      currentLocalFiles = [
        { filename: "postgres-backup-2026-09-20_06-17-20.dump", size: "194.9 KB", mod_time: "2026-09-20 06:17:20", path: "DeskManager\\backups\\postgres-backup-2026-09-20_06-17-20.dump" },
        { filename: "postgres-backup-2026-09-17_03-48-23.dump", size: "194.8 KB", mod_time: "2026-09-17 03:48:23", path: "DeskManager\\backups\\postgres-backup-2026-09-17_03-48-23.dump" },
        { filename: "postgres-backup-2026-09-16_06-28-43.dump", size: "185.9 KB", mod_time: "2026-09-16 06:28:43", path: "DeskManager\\backups\\postgres-backup-2026-09-16_06-28-43.dump" }
      ];
    }
    renderBackupTable(currentLocalFiles);
    populateUploadDropdown(currentLocalFiles);
    updateStats();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center loading-cell" style="color:#ef4444;">Failed to load backup files: ${err}</td></tr>`;
    updateStatus(`Error reading backup folder: ${err}`, "danger");
  }
}

function renderBackupTable(files) {
  const tableBody = document.getElementById("backupTableBody");
  if (!files || files.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center loading-cell">No backup files found in this directory.</td></tr>`;
    updateStatus(`Backup directory is empty.`, "info");
    return;
  }

  let html = "";
  files.forEach((file, index) => {
    html += `
      <tr data-index="${index}" onclick="selectRowByIndex(${index})">
        <td><strong>${escapeHtml(file.filename)}</strong></td>
        <td class="text-center">${escapeHtml(file.size)}</td>
        <td class="text-center">${escapeHtml(file.mod_time)}</td>
        <td><code>${escapeHtml(file.path)}</code></td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
  updateStatus(`Loaded ${files.length} backup file(s) from ${currentBackupPath}`, "success");
}

function selectRowByIndex(index) {
  const file = currentLocalFiles[index];
  if (!file) return;

  document.querySelectorAll("#backupTableBody tr").forEach(tr => tr.classList.remove("selected"));
  const rowEl = document.querySelector(`#backupTableBody tr[data-index="${index}"]`);
  if (rowEl) rowEl.classList.add("selected");

  selectedBackup = {
    filename: file.filename,
    size: file.size,
    mod_time: file.mod_time,
    path: file.path
  };
  updateStatus(`Selected: ${file.filename}`, "info");

  const select = document.getElementById("selectBackupToUpload");
  if (select) {
    select.value = file.filename;
  }
}

function selectRow(rowEl, filename, size, mod_time, path) {
  document.querySelectorAll("#backupTableBody tr").forEach(tr => tr.classList.remove("selected"));
  if (rowEl) rowEl.classList.add("selected");
  selectedBackup = { filename, size, mod_time, path };
  updateStatus(`Selected: ${filename}`, "info");

  const select = document.getElementById("selectBackupToUpload");
  if (select) {
    select.value = filename;
  }
}

function populateUploadDropdown(files) {
  const select = document.getElementById("selectBackupToUpload");
  select.innerHTML = `<option value="">-- Select a backup file to upload --</option>`;
  if (files) {
    files.forEach(f => {
      select.innerHTML += `<option value="${escapeHtml(f.filename)}">${escapeHtml(f.filename)} (${escapeHtml(f.size)})</option>`;
    });
  }
}

async function uploadBackupToGDrive() {
  const filename = document.getElementById("selectBackupToUpload").value;
  if (!filename) {
    showToast("Please select a local backup file to upload.", "warning");
    return;
  }

  const progressBox = document.getElementById("uploadProgressBox");
  const progressBar = document.getElementById("uploadProgressBar");
  const progressText = document.getElementById("uploadProgressText");

  progressBox.classList.remove("hidden");
  progressBar.style.width = "25%";
  progressText.textContent = `Connecting & uploading ${filename}...`;

  try {
    if (window.pywebview && window.pywebview.api) {
      progressBar.style.width = "65%";
      const res = await window.pywebview.api.upload_to_gdrive(filename);
      
      if (res && res.success) {
        progressBar.style.width = "100%";
        progressText.textContent = "Upload Complete!";
        showToast(`Successfully uploaded ${filename} to Google Drive!`, "success");
        await loadCloudHistory();
      } else {
        progressText.textContent = "Upload failed.";
        showToast(res.error || "Google Drive Upload Failed", "danger");
      }
    }
  } catch (err) {
    showToast(`Upload failed: ${err}`, "danger");
  } finally {
    setTimeout(() => {
      progressBox.classList.add("hidden");
      progressBar.style.width = "0%";
    }, 3000);
  }
}

async function loadCloudHistory() {
  const tableBody = document.getElementById("cloudTableBody");
  try {
    let cloudFiles = [];
    if (window.pywebview && window.pywebview.api) {
      cloudFiles = await window.pywebview.api.get_cloud_backups();
    }

    if (!cloudFiles || cloudFiles.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center loading-cell">No cloud backups uploaded yet.</td></tr>`;
      return;
    }

    let html = "";
    cloudFiles.forEach(f => {
      const driveUrl = f.drive_url || `https://drive.google.com/file/d/${f.cloud_id}/view`;
      html += `
        <tr>
          <td><strong>${f.filename}</strong></td>
          <td class="text-center"><code>${f.cloud_id}</code></td>
          <td class="text-center">${f.upload_time}</td>
          <td class="text-center">
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="openExternalUrl('${escapeJs(driveUrl)}')">
              View in Drive ↗
            </button>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
    updateStats();
  } catch (err) {
    console.error("Error loading cloud history:", err);
  }
}

function openExternalUrl(url) {
  if (window.pywebview && window.pywebview.api) {
    window.pywebview.api.open_external_url(url);
  } else {
    window.open(url, '_blank');
  }
}

function updateStats() {
  const localCount = document.getElementById("statLocalCount");
  const cloudCount = document.getElementById("statCloudCount");
  if (localCount) localCount.textContent = currentLocalFiles ? currentLocalFiles.length : 0;
  if (cloudCount) {
    if (window.pywebview && window.pywebview.api) {
      window.pywebview.api.get_cloud_backups().then(cb => {
        cloudCount.textContent = cb ? cb.length : 0;
      });
    }
  }
}

async function applyNewBackupLocation() {
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.change_backup_location();
      if (res && res.success) {
        currentBackupPath = res.backup_dir;
        document.getElementById("backupPathInput").value = currentBackupPath;
        const subEl = document.getElementById("statBackupSub");
        if (subEl) subEl.textContent = `In ${currentBackupPath}`;
        showToast(`Backup location updated: ${currentBackupPath}`, "success");
        await loadBackupFiles();
      }
    }
  } catch (err) {
    showToast(`Failed to change backup location: ${err}`, "danger");
  }
}

async function openBackupFolder() {
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.open_backup_folder();
      if (res && res.success) {
        showToast("Opened backup folder in Windows Explorer.", "success");
      } else if (res && res.error) {
        showToast(res.error, "danger");
      }
    }
  } catch (err) {
    showToast(`Could not open folder: ${err}`, "danger");
  }
}

async function takeBackup() {
  showToast("Creating database backup...", "info");
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.take_backup();
      if (res && res.success) {
        showToast(`Backup created: ${res.filename}`, "success");
        await loadBackupFiles();
      } else {
        showToast(res.error || "Failed to create backup", "danger");
      }
    }
  } catch (err) {
    showToast(`Backup failed: ${err}`, "danger");
  }
}

let pendingRestoreFile = null;

function openRestoreModalWithFile(fileObj) {
  pendingRestoreFile = fileObj;
  const detailsBox = document.getElementById("restoreDetailsBox");
  detailsBox.innerHTML = `
    <strong>File Name:</strong> ${fileObj.filename}<br>
    <strong>File Size:</strong> ${fileObj.size}<br>
    <strong>Created / Modified:</strong> ${fileObj.mod_time}<br>
    <strong>Full Path:</strong> ${fileObj.path}
  `;

  document.getElementById("restoreModal").classList.add("show");
}

async function triggerRestoreFromOtherLocation() {
  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.select_backup_file_dialog) {
      const res = await window.pywebview.api.select_backup_file_dialog();
      if (res && res.success && res.file) {
        openRestoreModalWithFile(res.file);
      } else if (res && !res.cancelled) {
        showToast(res.error || "No backup file selected.", "warning");
      }
    } else {
      showToast("File selection dialog is not available.", "warning");
    }
  } catch (err) {
    showToast(`Error opening file dialog: ${err}`, "danger");
  }
}

function triggerRestore() {
  triggerRestoreFromOtherLocation();
}

function closeRestoreModal() {
  document.getElementById("restoreModal").classList.remove("show");
  pendingRestoreFile = null;
}

async function submitRestore() {
  const fileToRestore = pendingRestoreFile;
  closeRestoreModal();
  if (!fileToRestore) return;

  showToast(`Restoring database from ${fileToRestore.filename}...`, "info");
  updateStatus(`Restoring database from ${fileToRestore.filename}...`, "warning");

  try {
    if (window.pywebview && window.pywebview.api) {
      const restoreTarget = fileToRestore.path || fileToRestore.filename;
      const res = await window.pywebview.api.use_backup_in_database(restoreTarget);
      if (res && res.success) {
        showToast(res.message || `Database successfully restored with backup: ${fileToRestore.filename}`, "success");
        updateStatus(`Database restored using ${fileToRestore.filename}`, "success");
        if (typeof loadBackupFiles === "function") {
          await loadBackupFiles();
        }
      } else {
        showToast(res.error || "Failed to restore database", "danger");
        updateStatus("Database restore failed", "danger");
      }
    }
  } catch (err) {
    showToast(`Restore failed: ${err}`, "danger");
    updateStatus("Database restore error", "danger");
  }
}

function triggerRename() {
  if (!selectedBackup) {
    showToast("Please select a backup file to rename.", "warning");
    return;
  }

  const input = document.getElementById("renameInput");
  input.value = selectedBackup.filename;
  document.getElementById("renameModal").classList.add("show");
  input.focus();
}

function closeRenameModal() {
  document.getElementById("renameModal").classList.remove("show");
}

async function submitRename() {
  const newName = document.getElementById("renameInput").value.trim();
  closeRenameModal();

  if (!selectedBackup || !newName || newName === selectedBackup.filename) {
    return;
  }

  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.rename_backup_file(selectedBackup.filename, newName);
      if (res && res.success) {
        showToast(`Renamed backup file to: ${newName}`, "success");
        await loadBackupFiles();
      } else {
        showToast(res.error || "Could not rename backup file.", "danger");
      }
    }
  } catch (err) {
    showToast(`Rename failed: ${err}`, "danger");
  }
}

async function triggerDelete() {
  if (!selectedBackup) {
    showToast("Please select a backup file to delete.", "warning");
    return;
  }

  if (confirm(`Are you sure you want to delete backup file:\n${selectedBackup.filename}?`)) {
    try {
      if (window.pywebview && window.pywebview.api) {
        const res = await window.pywebview.api.delete_backup_file(selectedBackup.filename);
        if (res && res.success) {
          showToast(`Deleted backup file: ${selectedBackup.filename}`, "warning");
          await loadBackupFiles();
        } else {
          showToast(res.error || "Could not delete file.", "danger");
        }
      }
    } catch (err) {
      showToast(`Delete failed: ${err}`, "danger");
    }
  }
}

function updateStatus(text, type = "info") {
  const statusText = document.getElementById("statusText");
  const statusIndicator = document.querySelector(".status-indicator");
  if (statusText) statusText.textContent = text;
  
  const colors = {
    success: "#22c55e",
    info: "#38bdf8",
    warning: "#f59e0b",
    danger: "#ef4444"
  };
  if (statusIndicator) statusIndicator.style.backgroundColor = colors[type] || "#22c55e";
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>●</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeJs(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}


// =================== PM2 & AUTOSTART BACKEND MANAGEMENT ===================
let currentPM2Status = null;
let pm2PollInterval = null;
let isPollingPM2 = false;

function startPM2Polling() {
  if (pm2PollInterval) return;
  pm2PollInterval = setInterval(async () => {
    const panel = document.getElementById("panel-autostart");
    if (panel && panel.classList.contains("active")) {
      if (isPollingPM2) return; // prevent overlapping calls
      isPollingPM2 = true;
      try {
        await loadPM2Status();
      } finally {
        isPollingPM2 = false;
      }
    } else {
      stopPM2Polling();
    }
  }, 3000);
}

function stopPM2Polling() {
  if (pm2PollInterval) {
    clearInterval(pm2PollInterval);
    pm2PollInterval = null;
  }
}

async function loadPM2Status() {
  try {
    if (window.pywebview && window.pywebview.api) {
      currentPM2Status = await window.pywebview.api.get_pm2_status();
    } else {
      currentPM2Status = {
        success: true,
        pm2_installed: true,
        pm2_version: "7.0.4",
        status: "online",
        service_name: "deskmanager-backend",
        pid: 1234,
        memory: "58.2 MB",
        cpu: "0%",
        restarts: 0,
        uptime: "12m 30s",
        autostart_active: true,
        startup_bat_path: "C:\\Users\\...\\deskmanager-resurrect.bat"
      };
    }
    renderPM2UI(currentPM2Status);
  } catch (err) {
    console.error("Error loading PM2 status:", err);
  }
}

function renderPM2UI(statusData) {
  if (!statusData) return;

  const statusBadge = document.getElementById("pm2StatusBadge");
  const statStatus = document.getElementById("pm2StatStatus");
  const statPid = document.getElementById("pm2StatPid");
  const statMemory = document.getElementById("pm2StatMemory");
  const statCpu = document.getElementById("pm2StatCpu");
  const statRestarts = document.getElementById("pm2StatRestarts");
  const statUptime = document.getElementById("pm2StatUptime");
  const statAutostart = document.getElementById("pm2StatAutostart");
  const startupBadge = document.getElementById("startupFileBadge");
  const startupPathDisplay = document.getElementById("startupBatPathDisplay");
  const btnSetup = document.getElementById("btnSetupAutostart");

  if (startupPathDisplay && statusData.startup_bat_path) {
    startupPathDisplay.textContent = statusData.startup_bat_path;
  }

  // Windows Startup File Badge
  if (startupBadge) {
    if (statusData.autostart_active) {
      startupBadge.className = "badge badge-connected";
      startupBadge.textContent = "● Active on Windows Boot";
    } else {
      startupBadge.className = "badge badge-disconnected";
      startupBadge.textContent = "● Not Active";
    }
  }

  if (statAutostart) {
    statAutostart.textContent = statusData.autostart_active ? "ENABLED" : "DISABLED";
    statAutostart.style.color = statusData.autostart_active ? "#22c55e" : "#94a3b8";
  }

  // Process status
  const status = (statusData.status || "not_created").toLowerCase();
  if (status === "online") {
    if (statusBadge) {
      statusBadge.className = "badge badge-connected";
      statusBadge.textContent = `● ONLINE (PID: ${statusData.pid || 'Active'})`;
    }
    if (statStatus) {
      statStatus.textContent = "ONLINE";
      statStatus.style.color = "#22c55e";
    }
    if (btnSetup) {
      btnSetup.innerHTML = `<span>⚡</span> Re-apply Autostart & PM2`;
    }
  } else if (status === "stopped") {
    if (statusBadge) {
      statusBadge.className = "badge badge-warning";
      statusBadge.textContent = "● STOPPED";
    }
    if (statStatus) {
      statStatus.textContent = "STOPPED";
      statStatus.style.color = "#f59e0b";
    }
  } else if (status === "errored") {
    if (statusBadge) {
      statusBadge.className = "badge badge-disconnected";
      statusBadge.textContent = "● ERRORED";
    }
    if (statStatus) {
      statStatus.textContent = "ERRORED";
      statStatus.style.color = "#ef4444";
    }
  } else {
    // not installed or not created
    if (statusBadge) {
      statusBadge.className = "badge badge-disconnected";
      statusBadge.textContent = statusData.pm2_installed ? "● Service Not Created" : "● PM2 Not Installed";
    }
    if (statStatus) {
      statStatus.textContent = "NOT RUNNING";
      statStatus.style.color = "#94a3b8";
    }
  }

  if (statPid) statPid.textContent = statusData.pid ? `PID: ${statusData.pid}` : "PID: --";
  if (statMemory) statMemory.textContent = statusData.memory || "0 MB";
  if (statCpu) statCpu.textContent = `CPU: ${statusData.cpu || '0%'}`;
  if (statRestarts) statRestarts.textContent = statusData.restarts || "0";
  if (statUptime) statUptime.textContent = `Uptime: ${statusData.uptime || 'Offline'}`;
}

async function setupAutostartProcess() {
  const btn = document.getElementById("btnSetupAutostart");
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span> Setting up PM2 & Autostart...`;
  }
  showToast("Installing PM2 & configuring backend daemon autostart...", "info");
  updateStatus("Configuring PM2 and Windows startup resurrect...", "info");

  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.setup_pm2_autostart();
      if (res && res.success) {
        showToast(res.message || "PM2 autostart enabled successfully!", "success");
        updateStatus("PM2 backend daemon is now online and autostart is enabled.", "success");
        await loadPM2Status();
        await loadPM2Logs();
      } else {
        showToast(res.error || "Failed to setup PM2 autostart", "danger");
        updateStatus(`PM2 Setup error: ${res.error || 'Unknown error'}`, "danger");
      }
    } else {
      showToast("Demo mode: PM2 setup simulated.", "success");
    }
  } catch (err) {
    showToast(`Setup error: ${err}`, "danger");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function controlPM2Service(action) {
  showToast(`Executing PM2 ${action}...`, "info");
  updateStatus(`Running PM2 action: ${action}...`, "info");
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.control_pm2_service(action);
      if (res && res.success) {
        showToast(res.message || `PM2 ${action} executed.`, "success");
        updateStatus(`PM2 ${action} completed successfully.`, "success");
        await loadPM2Status();
        await loadPM2Logs();
      } else {
        showToast(res.error || `Failed to execute ${action}`, "danger");
      }
    }
  } catch (err) {
    showToast(`Error: ${err}`, "danger");
  }
}

async function loadPM2Logs() {
  const logBox = document.getElementById("pm2LogsContent");
  if (logBox) logBox.textContent = "Fetching latest PM2 logs...";

  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.get_pm2_logs();
      if (res && res.success) {
        if (logBox) logBox.textContent = res.logs || "No logs available yet.";
      } else {
        if (logBox) logBox.textContent = res.error || "Could not retrieve logs.";
      }
    } else {
      if (logBox) logBox.textContent = "[PM2 Demo Logs]\nBackend server running on http://localhost:5000\nDatabase initialized";
    }
  } catch (err) {
    if (logBox) logBox.textContent = `Error reading logs: ${err}`;
  }
}

async function openWindowsStartupFolder() {
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.open_startup_folder();
      if (res && res.success) {
        showToast("Opened Windows Startup folder.", "success");
      } else {
        showToast(res.error || "Could not open folder", "danger");
      }
    }
  } catch (err) {
    showToast(`Error: ${err}`, "danger");
  }
}

async function openBackendDirectory() {
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.open_backend_folder();
      if (res && res.success) {
        showToast("Opened backend folder.", "success");
      } else {
        showToast(res.error || "Could not open folder", "danger");
      }
    }
  } catch (err) {
    showToast(`Error: ${err}`, "danger");
  }
}
