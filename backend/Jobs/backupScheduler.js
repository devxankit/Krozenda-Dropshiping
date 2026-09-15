const cron = require('node-cron');
const { runBackup } = require('./backupService');

// Default: 01:30 every night, server time.
const DEFAULT_SCHEDULE = '30 1 * * *';

function scheduleNightlyBackup() {
  const schedule = process.env.BACKUP_CRON_SCHEDULE || DEFAULT_SCHEDULE;

  if (!cron.validate(schedule)) {
    console.error(`Invalid BACKUP_CRON_SCHEDULE "${schedule}", nightly backup not scheduled`);
    return;
  }

  cron.schedule(schedule, () => {
    console.log('Running scheduled nightly backup...');
    runBackup()
      .then((run) => console.log(`Scheduled backup ${run.status}: ${run.filename}`))
      .catch((err) => console.error('Scheduled backup failed:', err.message));
  });

  console.log(`Nightly backup scheduled (cron: ${schedule})`);
}

module.exports = scheduleNightlyBackup;
