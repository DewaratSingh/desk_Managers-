const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Helper to format bytes into readable string
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper to format uptime in milliseconds to human readable
function formatUptime(uptimeMs) {
  if (!uptimeMs || uptimeMs <= 0) return '0s';
  const totalSeconds = Math.floor(uptimeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || (days === 0 && hours === 0)) parts.push(`${seconds}s`);

  return parts.join(' ');
}

// Helper to safely tail last N lines from a file
function readLastLines(filePath, maxLines = 60) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return '';
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(-maxLines).join('\n');
  } catch (err) {
    return `Error reading log file: ${err.message}`;
  }
}

/**
 * GET /api/monitor/pm2
 * Returns list of PM2 processes + system telemetry
 */
router.get('/pm2', (req, res) => {
  exec('pm2 jlist', { windowsHide: true }, (err, stdout, stderr) => {
    // Collect host system stats regardless of PM2 status
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus() || [];

    const systemInfo = {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.arch()}`,
      release: os.release(),
      node_version: process.version,
      cpu_model: cpus.length > 0 ? cpus[0].model : 'Unknown',
      cpu_count: cpus.length,
      total_memory_bytes: totalMem,
      free_memory_bytes: freeMem,
      used_memory_bytes: usedMem,
      memory_usage_percent: ((usedMem / totalMem) * 100).toFixed(1),
      total_memory_formatted: formatBytes(totalMem),
      used_memory_formatted: formatBytes(usedMem),
      free_memory_formatted: formatBytes(freeMem),
      system_uptime_seconds: os.uptime(),
      system_uptime_formatted: formatUptime(os.uptime() * 1000),
    };

    if (err) {
      console.warn('PM2 command execution notice:', err.message);
      return res.json({
        success: true,
        pm2_installed: false,
        message: 'PM2 daemon not running or not found in PATH.',
        system: systemInfo,
        processes: [],
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const pm2List = JSON.parse(stdout || '[]');
      const now = Date.now();

      const processes = pm2List.map((proc) => {
        const pm2Env = proc.pm2_env || {};
        const monit = proc.monit || {};
        const uptimeMs = pm2Env.pm_uptime ? now - pm2Env.pm_uptime : 0;
        const memoryBytes = monit.memory || 0;

        return {
          pm_id: proc.pm_id,
          name: proc.name || 'unnamed',
          pid: proc.pid || 0,
          status: pm2Env.status || 'unknown',
          cpu: typeof monit.cpu === 'number' ? monit.cpu : 0,
          memory_bytes: memoryBytes,
          memory_mb: (memoryBytes / (1024 * 1024)).toFixed(1),
          memory_formatted: formatBytes(memoryBytes),
          restarts: pm2Env.restart_time || 0,
          unstable_restarts: pm2Env.unstable_restarts || 0,
          uptime_ms: uptimeMs,
          uptime_formatted: pm2Env.status === 'online' ? formatUptime(uptimeMs) : '0s',
          created_at: pm2Env.created_at,
          exec_mode: pm2Env.exec_mode,
          node_version: pm2Env.node_version || process.version,
          pm_exec_path: pm2Env.pm_exec_path,
          out_log_path: pm2Env.pm_out_log_path,
          err_log_path: pm2Env.pm_err_log_path,
          watch: pm2Env.watch || false,
          autorestart: pm2Env.autorestart !== false,
        };
      });

      return res.json({
        success: true,
        pm2_installed: true,
        system: systemInfo,
        processes,
        timestamp: new Date().toISOString(),
      });
    } catch (parseErr) {
      console.error('Failed to parse PM2 output:', parseErr);
      return res.json({
        success: true,
        pm2_installed: true,
        message: 'PM2 returned non-JSON output',
        system: systemInfo,
        processes: [],
        timestamp: new Date().toISOString(),
      });
    }
  });
});

/**
 * GET /api/monitor/pm2/:id/logs
 * Returns latest standard out and error logs for a specific PM2 process
 */
router.get('/pm2/:id/logs', (req, res) => {
  const targetId = req.params.id;

  exec('pm2 jlist', { windowsHide: true }, (err, stdout) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to access PM2 for logs' });
    }

    try {
      const pm2List = JSON.parse(stdout || '[]');
      const proc = pm2List.find(
        (p) => String(p.pm_id) === String(targetId) || String(p.name) === String(targetId)
      );

      if (!proc) {
        return res.status(404).json({ error: `PM2 process with ID/Name '${targetId}' not found.` });
      }

      const pm2Env = proc.pm2_env || {};
      const outLogs = readLastLines(pm2Env.pm_out_log_path, 80);
      const errLogs = readLastLines(pm2Env.pm_err_log_path, 80);

      return res.json({
        success: true,
        name: proc.name,
        pm_id: proc.pm_id,
        status: pm2Env.status,
        out_log_path: pm2Env.pm_out_log_path,
        err_log_path: pm2Env.pm_err_log_path,
        out_logs: outLogs,
        err_logs: errLogs,
      });
    } catch (parseErr) {
      return res.status(500).json({ error: 'Failed to retrieve logs from PM2' });
    }
  });
});

/**
 * POST /api/monitor/pm2/:id/action
 * Controls a PM2 process (restart, stop, reload)
 */
router.post('/pm2/:id/action', (req, res) => {
  const targetId = req.params.id;
  const action = (req.body.action || '').toLowerCase();

  const allowedActions = ['restart', 'stop', 'reload'];
  if (!allowedActions.includes(action)) {
    return res.status(400).json({ error: `Action '${action}' is not supported. Use: ${allowedActions.join(', ')}` });
  }

  // Prevent shell command injection: ensure targetId contains only safe characters
  if (!/^[a-zA-Z0-9_-]+$/.test(targetId)) {
    return res.status(400).json({ error: 'Invalid process identifier' });
  }

  exec(`pm2 ${action} ${targetId}`, { windowsHide: true }, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: `Failed to execute ${action}: ${stderr || err.message}` });
    }

    return res.json({
      success: true,
      message: `Successfully executed '${action}' on PM2 process '${targetId}'`,
      output: stdout,
    });
  });
});

module.exports = router;
