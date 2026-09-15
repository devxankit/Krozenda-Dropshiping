const path = require('path');
const fs = require('fs');
const { runBackup, listBackups, BACKUP_DIR, RETENTION_DAYS } = require('../Jobs/backupService');

function toRunView(run) {
  return {
    id: run.id,
    startedAt: run.startedAt,
    sizeMb: run.sizeMb || 0,
    durationSeconds: run.durationSeconds || 0,
    destination: run.filename,
    status: run.status,
  };
}

async function getBackups(req, res, next) {
  try {
    const runs = await listBackups();

    res.json({
      success: true,
      message: 'Backups fetched',
      data: {
        schedule: {
          daily: true,
          dailyAt: process.env.BACKUP_CRON_SCHEDULE || '01:30 (server time)',
          cloudReplication: false,
          retentionDays: RETENTION_DAYS,
          lastRestoreTestAt: null,
        },
        runs: runs.slice(0, 20).map(toRunView),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function triggerBackup(req, res, next) {
  try {
    const run = await runBackup();
    const ok = run.status === 'success';
    res.status(ok ? 200 : 500).json({
      success: ok,
      message: ok ? 'Backup completed' : `Backup failed: ${run.error || 'unknown error'}`,
      data: toRunView(run),
    });
  } catch (err) {
    next(err);
  }
}

async function downloadBackup(req, res, next) {
  try {
    // Resolve against the backup directory and reject anything that escapes
    // it (e.g. `../../.env`) before touching the filesystem.
    const safeName = path.basename(req.params.id);
    const filePath = path.join(BACKUP_DIR, safeName);

    if (path.dirname(filePath) !== BACKUP_DIR || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Backup file not found' });
    }

    res.download(filePath, safeName);
  } catch (err) {
    next(err);
  }
}

module.exports = { getBackups, triggerBackup, downloadBackup };
