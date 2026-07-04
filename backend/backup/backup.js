const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Checks if a backup file for today already exists.
 * @param {string} backupDirD - The path to the backup directory.
 * @param {string} dbName - The name of the database.
 * @returns {boolean} True if a backup for today exists, false otherwise.
 */
function hasTodayBackup(backupDirD, dbName) {
  if (!fs.existsSync(backupDirD)) {
    return false;
  }
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const prefix = `${dbName}-backup-${todayStr}`;
    const files = fs.readdirSync(backupDirD);
    return files.some(file => file.startsWith(prefix) && file.endsWith('.dump'));
  } catch (err) {
    console.error(`[Backup Warning] Error checking existing backups: ${err.message}`);
    return false;
  }
}

/**
 * Rotates database backup files on the D drive, deleting those older than 4 days based on the filename timestamp.
 * @param {string} backupDirD - The path to the backup directory.
 * @param {string} dbName - The name of the database.
 */
function rotateBackups(backupDirD, dbName) {
  try {
    if (!fs.existsSync(backupDirD)) {
      return;
    }
    const files = fs.readdirSync(backupDirD);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Regex to match our filename format: dbName-backup-YYYY-MM-DD_HH-mm-ss.dump
    const dateRegex = new RegExp(`^${dbName}-backup-(\\d{4})-(\\d{2})-(\\d{2})_\\d{2}-\\d{2}-\\d{2}\\.dump$`);

    for (const file of files) {
      const match = file.match(dateRegex);
      if (match) {
        const fileYear = parseInt(match[1], 10);
        const fileMonth = parseInt(match[2], 10);
        const fileDay = parseInt(match[3], 10);
        
        const fileCalendarDate = new Date(fileYear, fileMonth - 1, fileDay);
        
        // Calculate difference in days
        const diffTime = today - fileCalendarDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 4) {
          const filePath = path.join(backupDirD, file);
          console.log(`[Backup Retention] Deleting backup older than 4 days (${diffDays} days old): ${file}`);
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch (err) {
    console.error(`[Backup Warning] Failed to clean up old backups: ${err.message}`);
  }
}

/**
 * Executes a PostgreSQL database backup using pg_dump.
 * Saves the backup to the D drive if a backup for today doesn't exist, and cleans up backups older than 4 days.
 */
async function runBackup() {
  console.log('--- Starting Database Backup ---');

  const dbName = process.env.DB_DATABASE || 'postgres';
  const backupDirD = process.env.BACKUP_PATH_D || 'D:\\deskManager-backups';

  // Check if today's backup is already available
  if (hasTodayBackup(backupDirD, dbName)) {
    const todayStr = new Date().toISOString().split('T')[0];
    console.log(`[Backup Info] Backup for today (${todayStr}) already exists. Skipping database dump.`);
    // Run rotation anyway to clean up any old files
    rotateBackups(backupDirD, dbName);
    return;
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  const fileName = `${dbName}-backup-${timestamp}.dump`;
  const localFilePath = path.join(backupDirD, fileName);

  try {
    console.log(`Ensuring backup directory exists: ${backupDirD}`);
    fs.mkdirSync(backupDirD, { recursive: true });
  } catch (err) {
    console.error(`[Backup Error] Failed to create backup directory on D drive: ${err.message}`);
    throw err;
  }

  console.log(`Dumping database to: ${localFilePath}`);
  const dbUser = process.env.DB_USER || 'postgres';
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';

  const pgDumpArgs = [
    '-U', dbUser,
    '-h', dbHost,
    '-p', dbPort,
    '-d', dbName,
    '-F', 'c', // Custom archive format
    '-f', localFilePath
  ];

  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PGPASSWORD: process.env.DB_PASSWORD || 'postgres'
    };

    const pgDumpPath = process.env.PG_DUMP_PATH || 'pg_dump';
    const pgDumpProcess = spawn(pgDumpPath, pgDumpArgs, { env });

    let stderr = '';

    pgDumpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pgDumpProcess.on('error', (err) => {
      if (err.code === 'ENOENT') {
        const msg = `pg_dump executable not found at "${pgDumpPath}". Make sure PostgreSQL command-line tools are installed and added to the PATH or configured via PG_DUMP_PATH.`;
        console.error(`[Backup Error] ${msg}`);
        reject(new Error(msg));
      } else {
        console.error(`[Backup Error] Process error: ${err.message}`);
        reject(err);
      }
    });

    pgDumpProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[Backup Success] Saved database backup to D drive: ${localFilePath}`);
        
        // Rotate backups - delete those older than 4 days
        rotateBackups(backupDirD, dbName);
        
        resolve(localFilePath);
      } else {
        const errMsg = `pg_dump exited with code ${code}. Error details: ${stderr}`;
        console.error(`[Backup Error] ${errMsg}`);
        reject(new Error(errMsg));
      }
    });
  });
}

// Support running the file directly
if (require.main === module) {
  // If run directly, load the .env relative to this script
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  runBackup()
    .then(() => {
      console.log('Backup process completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup process failed:', err.message);
      process.exit(1);
    });
}

module.exports = { runBackup };
