let selectedBackup = null;
let currentBackupPath = "";
let currentLocalFiles = [];
let currentAuthMode = "oauth";
let currentNetworkInfo = { ipv4: "127.0.0.1", hostname: "DESKTOP", url: "http://127.0.0.1:5000" };

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("pywebviewready", () => {
    initApp();
  });

  setTimeout(() => {
    if (window.pywebview && window.pywebview.api) {
      initApp();
    }
  }, 300);
});

async function initApp() {
  await loadBackupConfig();
  await loadGDriveConfig();
  await loadBackupFiles();
  await loadCloudHistory();
  await loadNetworkInfo();
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
    loadNetworkInfo();
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
        document.getElementById("gdriveClientIdInput").value = gconfig.client_id || "";
        document.getElementById("gdriveClientSecretInput").value = gconfig.client_secret || "";
        document.getElementById("gdriveTokenInput").value = gconfig.access_token || "";
        document.getElementById("gdriveFolderInput").value = gconfig.folder_id || "";
        updateGDriveBadge(!!gconfig.refresh_token || !!gconfig.access_token, !!gconfig.refresh_token);
      }
    }
  } catch (err) {
    console.error("Error loading GDrive config:", err);
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
  const clientId = document.getElementById("gdriveClientIdInput").value.trim();
  const clientSecret = document.getElementById("gdriveClientSecretInput").value.trim();
  const token = document.getElementById("gdriveTokenInput").value.trim();
  const folder = document.getElementById("gdriveFolderInput").value.trim();

  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.save_gdrive_config({
        client_id: clientId,
        client_secret: clientSecret,
        access_token: token,
        folder_id: folder
      });
      if (res && res.success) {
        showToast("Google Drive API credentials saved successfully!", "success");
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
        { filename: "postgres-backup-2026-09-20_06-17-20.dump", size: "194.9 KB", mod_time: "2026-09-20 06:17:20", path: "D:\\deskManager-backups\\postgres-backup-2026-09-20_06-17-20.dump" },
        { filename: "postgres-backup-2026-09-17_03-48-23.dump", size: "194.8 KB", mod_time: "2026-09-17 03:48:23", path: "D:\\deskManager-backups\\postgres-backup-2026-09-17_03-48-23.dump" },
        { filename: "postgres-backup-2026-09-16_06-28-43.dump", size: "185.9 KB", mod_time: "2026-09-16 06:28:43", path: "D:\\deskManager-backups\\postgres-backup-2026-09-16_06-28-43.dump" }
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
  files.forEach((file) => {
    html += `
      <tr onclick="selectRow(this, '${escapeJs(file.filename)}', '${escapeJs(file.size)}', '${escapeJs(file.mod_time)}', '${escapeJs(file.path)}')">
        <td><strong>${file.filename}</strong></td>
        <td class="text-center">${file.size}</td>
        <td class="text-center">${file.mod_time}</td>
        <td><code>${file.path}</code></td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
  updateStatus(`Loaded ${files.length} backup file(s) from ${currentBackupPath}`, "success");
}

function populateUploadDropdown(files) {
  const select = document.getElementById("selectBackupToUpload");
  select.innerHTML = `<option value="">-- Select a backup file to upload --</option>`;
  if (files) {
    files.forEach(f => {
      select.innerHTML += `<option value="${escapeJs(f.filename)}">${f.filename} (${f.size})</option>`;
    });
  }
}

function selectRow(rowEl, filename, size, mod_time, path) {
  document.querySelectorAll("#backupTableBody tr").forEach(tr => tr.classList.remove("selected"));
  rowEl.classList.add("selected");
  selectedBackup = { filename, size, mod_time, path };
  updateStatus(`Selected: ${filename}`, "info");

  const select = document.getElementById("selectBackupToUpload");
  if (select) {
    select.value = filename;
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

function triggerRestore() {
  if (!selectedBackup) {
    showToast("Please select a backup file from the list first.", "warning");
    return;
  }

  const detailsBox = document.getElementById("restoreDetailsBox");
  detailsBox.innerHTML = `
    <strong>File Name:</strong> ${selectedBackup.filename}<br>
    <strong>File Size:</strong> ${selectedBackup.size}<br>
    <strong>Created Date:</strong> ${selectedBackup.mod_time}<br>
    <strong>Full Path:</strong> ${selectedBackup.path}
  `;

  document.getElementById("restoreModal").classList.add("show");
}

function closeRestoreModal() {
  document.getElementById("restoreModal").classList.remove("show");
}

async function submitRestore() {
  closeRestoreModal();
  if (!selectedBackup) return;

  showToast(`Restoring database from ${selectedBackup.filename}...`, "info");
  try {
    if (window.pywebview && window.pywebview.api) {
      const res = await window.pywebview.api.use_backup_in_database(selectedBackup.filename);
      if (res && res.success) {
        showToast(`Database successfully restored with backup: ${selectedBackup.filename}`, "success");
        updateStatus(`Database restored using ${selectedBackup.filename}`, "success");
      } else {
        showToast(res.error || "Failed to restore database", "danger");
      }
    }
  } catch (err) {
    showToast(`Restore failed: ${err}`, "danger");
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
