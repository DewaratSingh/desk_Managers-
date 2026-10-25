const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

/**
 * Automatically refreshes the Google Drive access token using the refresh_token.
 * Updates the database record if a new access_token is obtained.
 */
async function getValidAccessToken(keyRecord) {
  if (!keyRecord) return null;

  const refreshToken = (keyRecord.refresh_token || '').trim();
  const clientId = (keyRecord.client_id || '').trim();
  const clientSecret = (keyRecord.client_secret || '').trim();

  // If we have refresh credentials, refresh the token
  if (refreshToken && clientId && clientSecret) {
    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (resp.ok) {
        const data = await resp.json();
        const newToken = data.access_token;
        if (newToken) {
          // Update in database
          await pool.query(
            'UPDATE keys SET access_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newToken, keyRecord.id]
          );
          return newToken;
        }
      } else {
        const errText = await resp.text();
        console.warn('Google Drive token refresh failed:', errText);
      }
    } catch (err) {
      console.error('Error refreshing Google Drive token:', err.message);
    }
  }

  return (keyRecord.access_token || '').trim() || null;
}

/**
 * Tests connection to Google Drive API using stored credentials.
 */
async function testGoogleDriveConnection(keyRecord) {
  const token = await getValidAccessToken(keyRecord);
  if (!token) {
    return { success: false, error: 'No Google Drive access token or credentials configured.' };
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };
    if (keyRecord.cookies) {
      headers['Cookie'] = keyRecord.cookies;
    }

    const resp = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      method: 'GET',
      headers,
    });

    if (!resp.ok) {
      const errData = await resp.text();
      return { success: false, error: `Google API Error (${resp.status}): ${errData}` };
    }

    const data = await resp.json();
    const email = data.user?.emailAddress || 'Connected Google Account';

    // Update account_email in keys table
    if (keyRecord.id && data.user?.emailAddress) {
      await pool.query('UPDATE keys SET account_email = $1 WHERE id = $2', [email, keyRecord.id]);
    }

    return {
      success: true,
      account_email: email,
      is_permanent: Boolean(keyRecord.refresh_token),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Exchanges Google OAuth 2.0 authorization code for access_token and refresh_token.
 */
async function exchangeAuthCode(code, clientId, clientSecret, redirectUri) {
  const body = new URLSearchParams({
    code: code.trim(),
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    redirect_uri: redirectUri.trim(),
    grant_type: 'authorization_code',
  });

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google token exchange error (${resp.status}): ${errText}`);
  }

  return await resp.json();
}

/**
 * Uploads a local file from the server to Google Drive via multipart upload.
 */
async function uploadToGoogleDrive(filePath, filename, keyRecord) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Local file not found: ${filePath}`);
  }

  const token = await getValidAccessToken(keyRecord);
  if (!token) {
    throw new Error('No valid Google Drive access token available. Please authorize Google Drive first.');
  }

  const folderId = (keyRecord.folder_id || '').trim();
  const metadata = { name: filename };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = `----DeskManageUploadBoundary${Date.now()}`;
  const fileBuffer = fs.readFileSync(filePath);

  const headerPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`;

  const footerPart = `\r\n--${boundary}--\r\n`;

  const fullPayload = Buffer.concat([
    Buffer.from(headerPart, 'utf-8'),
    fileBuffer,
    Buffer.from(footerPart, 'utf-8'),
  ]);

  const reqHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': String(fullPayload.length),
  };

  if (keyRecord.cookies) {
    reqHeaders['Cookie'] = keyRecord.cookies;
  }

  const uploadResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: reqHeaders,
      body: fullPayload,
    }
  );

  if (!uploadResp.ok) {
    const errData = await uploadResp.text();
    throw new Error(`Google Drive API upload failed (${uploadResp.status}): ${errData}`);
  }

  const result = await uploadResp.json();
  return {
    success: true,
    file_id: result.id,
    filename: result.name || filename,
    webViewLink: result.webViewLink,
  };
}

module.exports = {
  getValidAccessToken,
  testGoogleDriveConnection,
  exchangeAuthCode,
  uploadToGoogleDrive,
};
