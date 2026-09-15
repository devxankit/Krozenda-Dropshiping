const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');

// Sibling to uploads/, kept OFF express.static — backup files can contain
// full customer/order data, so they're only ever served through the
// authenticated admin download endpoint.
const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30);
const MANIFEST_FILE = path.join(BACKUP_DIR, 'manifest.json');

async function ensureBackupDir() {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
}

async function readManifest() {
  try {
    const raw = await fsp.readFile(MANIFEST_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function writeManifest(runs) {
  await fsp.writeFile(MANIFEST_FILE, JSON.stringify(runs, null, 2));
}

// A dependency-free full dump: every collection's documents, gzipped as one
// JSON file. Avoids requiring the mongodb-database-tools binary (mongodump)
// to be installed on the host.
async function dumpDatabase(destPath) {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const gzip = zlib.createGzip();
  const output = fs.createWriteStream(destPath);
  const finished = new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
    gzip.on('error', reject);
  });
  gzip.pipe(output);

  gzip.write('{');
  for (let i = 0; i < collections.length; i += 1) {
    const name = collections[i].name;
    const docs = await db.collection(name).find({}).toArray();
    gzip.write(`${i > 0 ? ',' : ''}${JSON.stringify(name)}:${JSON.stringify(docs)}`);
  }
  gzip.write('}');
  gzip.end();

  await finished;
}

async function pruneOldBackups(runs) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const kept = [];

  for (const run of runs) {
    if (run.status !== 'running' && new Date(run.startedAt).getTime() < cutoff) {
      try {
        await fsp.unlink(path.join(BACKUP_DIR, run.filename));
      } catch (err) {
        // already removed, nothing to do
      }
    } else {
      kept.push(run);
    }
  }

  return kept;
}

async function runBackup() {
  await ensureBackupDir();

  const startedAt = new Date();
  const filename = `backup-${startedAt.toISOString().replace(/[:.]/g, '-')}.json.gz`;
  const destPath = path.join(BACKUP_DIR, filename);

  let run = {
    id: filename,
    filename,
    startedAt: startedAt.toISOString(),
    status: 'running',
    sizeMb: 0,
    durationSeconds: 0,
  };

  let runs = await readManifest();
  runs.unshift(run);
  await writeManifest(runs);

  try {
    await dumpDatabase(destPath);
    const stats = await fsp.stat(destPath);
    run = {
      ...run,
      status: 'success',
      sizeMb: Number((stats.size / (1024 * 1024)).toFixed(2)),
      durationSeconds: Number(((Date.now() - startedAt.getTime()) / 1000).toFixed(1)),
    };
  } catch (err) {
    run = {
      ...run,
      status: 'failed',
      error: err.message,
      durationSeconds: Number(((Date.now() - startedAt.getTime()) / 1000).toFixed(1)),
    };
  }

  runs = await readManifest();
  const idx = runs.findIndex((r) => r.id === run.id);
  if (idx >= 0) runs[idx] = run;
  else runs.unshift(run);

  runs = await pruneOldBackups(runs);
  await writeManifest(runs);

  return run;
}

async function listBackups() {
  await ensureBackupDir();
  return readManifest();
}

module.exports = { runBackup, listBackups, BACKUP_DIR, RETENTION_DAYS };
