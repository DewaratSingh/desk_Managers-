const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { runBackup, getBackupDirectory } = require('../backup/backup');
const {
  testGoogleDriveConnection,
  exchangeAuthCode,
  uploadToGoogleDrive,
} = require('../backup/gdrive');

// Helper to retrieve keys row for the company / default
async function getKeyRecord(companyId = null) {
  let query = 'SELECT * FROM keys WHERE service_name = $1';
  let params = ['google_drive'];

  if (companyId) {
    query += ' AND company_id = $2';
    params.push(companyId);
  } else {
    query += ' ORDER BY id DESC LIMIT 1';
  }

  const res = await pool.query(query, params);
  return res.rows[0] || null;
}

/**
 * GET /api/backup/keys
 * Returns Google Drive configuration and connection status (secrets masked)
 */
router.get('/keys', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    const record = await getKeyRecord(companyId);

    if (!record) {
      return res.json({
        success: true,
        configured: false,
        keys: {
          client_id: '',
          client_secret: '',
          folder_id: '',
          cookies: '',
          auth_mode: 'oauth',
          account_email: null,
          is_connected: false,
          last_backup_date: null,
          alert_interval_days: 3,
          alert_interval_seconds: 259200,
        },
      });
    }

    const hasSecret = Boolean(record.client_secret && record.client_secret.trim());
    const isConnected = Boolean(record.refresh_token || record.access_token);
    const intervalSeconds = record.alert_interval_seconds !== null && record.alert_interval_seconds !== undefined
      ? record.alert_interval_seconds
      : (record.alert_interval_days !== null && record.alert_interval_days !== undefined ? record.alert_interval_days * 86400 : 259200);

    return res.json({
      success: true,
      configured: true,
      keys: {
        client_id: record.client_id || '',
        client_secret_masked: hasSecret ? '••••••••••••••••' : '',
        folder_id: record.folder_id || '',
        cookies: record.cookies || '',
        auth_mode: record.auth_mode || 'oauth',
        account_email: record.account_email || null,
        is_connected: isConnected,
        last_backup_date: record.last_backup_date || null,
        alert_interval_days: record.alert_interval_days !== null && record.alert_interval_days !== undefined ? record.alert_interval_days : 3,
        alert_interval_seconds: intervalSeconds,
      },
    });
  } catch (err) {
    console.error('Error fetching backup keys:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/keys
 * Saves or updates Google Drive credentials in keys table
 */
router.post('/keys', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    const {
      client_id,
      client_secret,
      folder_id,
      cookies,
      auth_mode = 'oauth',
      access_token,
      refresh_token,
      alert_interval_days,
    } = req.body;

    const existing = await getKeyRecord(companyId);

    // If client_secret is omitted or masked, keep the existing one
    let finalSecret = existing ? existing.client_secret : '';
    if (client_secret && !client_secret.includes('••') && client_secret.trim() !== '') {
      finalSecret = client_secret.trim();
    }

    let finalAccessToken = existing ? existing.access_token : '';
    if (access_token && access_token.trim() !== '') {
      finalAccessToken = access_token.trim();
    }

    let finalRefreshToken = existing ? existing.refresh_token : '';
    if (refresh_token && refresh_token.trim() !== '') {
      finalRefreshToken = refresh_token.trim();
    }

    const intervalVal = alert_interval_days !== undefined ? parseInt(alert_interval_days, 10) : (existing?.alert_interval_days || 3);

    if (existing) {
      await pool.query(
        `UPDATE keys SET
          client_id = $1,
          client_secret = $2,
          folder_id = $3,
          cookies = $4,
          auth_mode = $5,
          access_token = $6,
          refresh_token = $7,
          alert_interval_days = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9`,
        [
          (client_id || '').trim(),
          finalSecret,
          (folder_id || '').trim(),
          (cookies || '').trim(),
          auth_mode,
          finalAccessToken,
          finalRefreshToken,
          intervalVal,
          existing.id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO keys (
          service_name, client_id, client_secret, folder_id, cookies, auth_mode,
          access_token, refresh_token, alert_interval_days, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          'google_drive',
          (client_id || '').trim(),
          finalSecret,
          (folder_id || '').trim(),
          (cookies || '').trim(),
          auth_mode,
          finalAccessToken,
          finalRefreshToken,
          intervalVal,
          companyId,
        ]
      );
    }

    return res.json({ success: true, message: 'Google credentials saved successfully.' });
  } catch (err) {
    console.error('Error saving backup keys:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/alert-threshold
 * Updates the user's selected backup overdue alert interval (e.g. 20s, 60s, 1d, 3d, etc.)
 */
router.post('/alert-threshold', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    const { alert_interval_seconds, alert_interval_days } = req.body;

    let seconds = undefined;
    if (alert_interval_seconds !== undefined) {
      seconds = parseInt(alert_interval_seconds, 10);
    } else if (alert_interval_days !== undefined) {
      seconds = parseInt(alert_interval_days, 10) * 86400;
    }

    if (seconds === undefined || isNaN(seconds) || seconds < 0) {
      return res.status(400).json({ success: false, error: 'Invalid alert interval.' });
    }

    const days = Math.round(seconds / 86400);

    const existing = await getKeyRecord(companyId);
    if (existing) {
      await pool.query(
        'UPDATE keys SET alert_interval_seconds = $1, alert_interval_days = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [seconds, days, existing.id]
      );
    } else {
      await pool.query(
        'INSERT INTO keys (service_name, alert_interval_seconds, alert_interval_days, company_id) VALUES ($1, $2, $3, $4)',
        ['google_drive', seconds, days, companyId]
      );
    }

    return res.json({
      success: true,
      message: `Backup alert threshold updated to ${seconds} second(s).`,
      alert_interval_seconds: seconds,
      alert_interval_days: days,
    });
  } catch (err) {
    console.error('Error updating alert threshold:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/auth-url
 * Returns Google OAuth 2.0 authorization URL for client computer browser
 */
router.get('/auth-url', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    const record = await getKeyRecord(companyId);

    if (!record || !record.client_id) {
      return res.status(400).json({
        success: false,
        error: 'Google Client ID is missing. Please save your Client ID and Client Secret first.',
      });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const redirectUri = `${protocol}://${host}/api/backup/auth/callback`;

    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file');
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(record.client_id)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${scope}&` +
      `access_type=offline&` +
      `prompt=consent`;

    return res.json({ success: true, auth_url: authUrl, redirect_uri: redirectUri });
  } catch (err) {
    console.error('Error generating auth URL:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/auth/callback
 * Handles OAuth 2.0 redirect from Google
 */
router.get('/auth/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Authentication Failed</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:48px;background:#0f172a;color:#f8fafc;">
            <h2 style="color:#f43f5e;">Authentication Failed</h2>
            <p style="color:#94a3b8;">${error}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: ${JSON.stringify(error)} }, '*');
                setTimeout(function() { window.close(); }, 1500);
              } else {
                window.location.href = '/backup?auth_error=' + encodeURIComponent(${JSON.stringify(error)});
              }
            </script>
          </body>
        </html>
      `);
    }

    if (!code) {
      return res.redirect('/backup?auth_error=No_authorization_code_received');
    }

    const record = await getKeyRecord();
    if (!record || !record.client_id || !record.client_secret) {
      return res.redirect('/backup?auth_error=Missing_client_credentials_on_server');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const redirectUri = `${protocol}://${host}/api/backup/auth/callback`;

    const tokenData = await exchangeAuthCode(
      code,
      record.client_id,
      record.client_secret,
      redirectUri
    );

    const accessToken = tokenData.access_token || '';
    const refreshToken = tokenData.refresh_token || record.refresh_token || '';

    await pool.query(
      `UPDATE keys SET access_token = $1, refresh_token = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [accessToken, refreshToken, record.id]
    );

    // Test connection to fetch email
    const updatedRecord = await getKeyRecord();
    await testGoogleDriveConnection(updatedRecord);

    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Google Authentication Successful</title>
        </head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:48px 24px;background:#0f172a;color:#f8fafc;">
          <div style="max-width:440px;margin:0 auto;background:#1e293b;padding:32px;border-radius:16px;border:1px solid #334155;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <div style="width:48px;height:48px;background:rgba(16,185,129,0.2);border:1px solid #10b981;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#10b981;font-size:24px;">✓</div>
            <h2 style="color:#f8fafc;margin:0 0 8px;font-size:20px;">Google Drive Connected!</h2>
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0 0 20px;">Google credentials have been securely stored in the server's keys table.</p>
            <p style="color:#64748b;font-size:12px;">Returning to DeskManager...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              setTimeout(function() { window.close(); }, 800);
            } else {
              window.location.href = '/backup?auth_success=1';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Error in OAuth callback:', err);
    return res.redirect(`/backup?auth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * POST /api/backup/user-auth
 * Saves user cookies or token and immediately tests connection with Google Drive
 */
router.post('/user-auth', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    const { cookies, access_token, folder_id } = req.body;

    const record = await getKeyRecord(companyId);
    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'Please configure Google Cloud Client ID and Secret in the database first.',
      });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (cookies !== undefined) {
      updates.push(`cookies = $${idx++}`);
      params.push(cookies.trim());
    }

    if (access_token !== undefined && access_token.trim()) {
      updates.push(`access_token = $${idx++}`);
      params.push(access_token.trim());
    }

    if (folder_id !== undefined) {
      updates.push(`folder_id = $${idx++}`);
      params.push(folder_id.trim());
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(record.id);

    await pool.query(
      `UPDATE keys SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    const updated = await getKeyRecord(companyId);
    const testResult = await testGoogleDriveConnection(updated);

    return res.json({
      success: true,
      message: testResult.success
        ? 'Google credentials verified and saved to server!'
        : 'Credentials saved, but verification failed.',
      connected: testResult.success,
      email: testResult.account_email,
      test_error: testResult.error,
    });
  } catch (err) {
    console.error('Error in user-auth:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/test
 * Tests Google Drive connection with stored keys
 */
router.post('/test', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    const record = await getKeyRecord(companyId);

    if (!record) {
      return res.status(400).json({ success: false, error: 'No Google Drive keys configured.' });
    }

    const result = await testGoogleDriveConnection(record);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/take-backup
 * Takes a PostgreSQL backup on the server machine, and uploads it to Google Drive
 */
router.post('/take-backup', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    console.log('[Backup API] User triggered manual backup from web UI');

    // 1. Force a fresh database dump on server
    const backupFilePath = await runBackup({ force: true });

    if (!backupFilePath || !fs.existsSync(backupFilePath)) {
      return res.status(500).json({
        success: false,
        error: 'Database backup dump failed on server.',
      });
    }

    const filename = path.basename(backupFilePath);
    const stats = fs.statSync(backupFilePath);

    // 2. Upload to Google Drive if credentials exist
    let uploadResult = null;
    let uploadError = null;

    const record = await getKeyRecord(companyId);
    if (record && (record.refresh_token || record.access_token)) {
      try {
        console.log(`[Backup API] Uploading ${filename} to Google Drive...`);
        uploadResult = await uploadToGoogleDrive(backupFilePath, filename, record);
      } catch (upErr) {
        console.error('[Backup API] Google Drive upload error:', upErr.message);
        uploadError = upErr.message;
      }
    }

    // 3. Update last_backup_date in keys table
    const now = new Date();
    if (record) {
      await pool.query(
        'UPDATE keys SET last_backup_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [now, record.id]
      );
    } else {
      await pool.query(
        'INSERT INTO keys (service_name, last_backup_date, company_id) VALUES ($1, $2, $3)',
        ['google_drive', now, companyId]
      );
    }

    return res.json({
      success: true,
      message: uploadResult
        ? 'Backup created on server and uploaded to Google Drive!'
        : uploadError
        ? `Backup created on server, but cloud upload failed: ${uploadError}`
        : 'Backup created successfully on server machine.',
      filename,
      size_bytes: stats.size,
      uploaded_to_drive: Boolean(uploadResult?.success),
      upload_error: uploadError,
      last_backup_date: now.toISOString(),
    });
  } catch (err) {
    console.error('Error during take-backup:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/backup/files
 * Returns list of local backup files stored on the server computer
 */
router.get('/files', async (req, res) => {
  try {
    const backupDir = getBackupDirectory();

    if (!fs.existsSync(backupDir)) {
      return res.json({ success: true, backup_dir: backupDir, files: [] });
    }

    const dirFiles = fs.readdirSync(backupDir);
    const backupFiles = [];

    for (const file of dirFiles) {
      if (file.endsWith('.dump') || file.endsWith('.sql')) {
        const filePath = path.join(backupDir, file);
        try {
          const stats = fs.statSync(filePath);
          backupFiles.push({
            filename: file,
            size_bytes: stats.size,
            size_formatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            created_at: stats.mtime.toISOString(),
          });
        } catch (e) {
          // ignore unreadable file
        }
      }
    }

    // Sort descending by created date
    backupFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({
      success: true,
      backup_dir: backupDir,
      files: backupFiles,
    });
  } catch (err) {
    console.error('Error reading backup files:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/upload-local
 * Uploads an existing local server backup to Google Drive
 */
router.post('/upload-local', async (req, res) => {
  try {
    const companyId = req.user?.company_id || null;
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ success: false, error: 'Filename is required' });
    }

    const backupDir = getBackupDirectory();
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Backup file does not exist on server' });
    }

    const record = await getKeyRecord(companyId);
    if (!record || (!record.refresh_token && !record.access_token)) {
      return res.status(400).json({
        success: false,
        error: 'Google Drive is not authorized. Please connect or save your credentials first.',
      });
    }

    const result = await uploadToGoogleDrive(filePath, filename, record);

    const now = new Date();
    await pool.query(
      'UPDATE keys SET last_backup_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [now, record.id]
    );

    return res.json({
      success: true,
      message: `Successfully uploaded ${filename} to Google Drive!`,
      result,
      last_backup_date: now.toISOString(),
    });
  } catch (err) {
    console.error('Error uploading local file to Drive:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
