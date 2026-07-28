import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];

const pass = message => passes.push(message);
const fail = message => failures.push(message);

const requiredFiles = [
  'agrismart-final-app.js',
  'agrismart-reports.js',
  'agrismart-inventory.js',
  'sync-manager.js',
  'sync-integration.js',
  'cloud-sync-provider.js',
  'service-worker.js',
  'register-service-worker.js'
];

for (const file of requiredFiles) {
  try {
    await access(path.join(root, file), constants.R_OK);
    pass(`Required file exists: ${file}`);
  } catch {
    fail(`Missing required file: ${file}`);
  }
}

const rootEntries = await readdir(root, { withFileTypes: true });
const javascriptFiles = rootEntries
  .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
  .map(entry => entry.name)
  .sort();

for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status === 0) pass(`JavaScript syntax valid: ${file}`);
  else fail(`JavaScript syntax error in ${file}: ${result.stderr.trim() || result.stdout.trim()}`);
}

const manifestCandidates = ['manifest.json', 'manifest.webmanifest'];
let manifestPath = null;
for (const candidate of manifestCandidates) {
  try {
    await access(path.join(root, candidate), constants.R_OK);
    manifestPath = candidate;
    break;
  } catch {
    // Try the next supported manifest name.
  }
}

if (manifestPath) {
  try {
    const manifest = JSON.parse(await readFile(path.join(root, manifestPath), 'utf8'));
    for (const field of ['name', 'short_name', 'start_url', 'display']) {
      if (!manifest[field]) fail(`PWA manifest is missing required field: ${field}`);
    }
    if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
      fail('PWA manifest must define at least one icon');
    } else {
      pass(`PWA manifest valid: ${manifestPath}`);
    }
  } catch (error) {
    fail(`Invalid PWA manifest ${manifestPath}: ${error.message}`);
  }
} else {
  fail('No PWA manifest found (manifest.json or manifest.webmanifest)');
}

try {
  const serviceWorker = await readFile(path.join(root, 'service-worker.js'), 'utf8');
  if (!/\binstall\b/.test(serviceWorker)) fail('Service worker has no install lifecycle handler');
  if (!/\bactivate\b/.test(serviceWorker)) fail('Service worker has no activate lifecycle handler');
  if (!/\bfetch\b/.test(serviceWorker)) fail('Service worker has no fetch lifecycle handler');
  if (/skipWaiting\s*\(\s*\)/.test(serviceWorker) && !/message/.test(serviceWorker)) {
    fail('Service worker calls skipWaiting without an explicit update-message flow');
  } else {
    pass('Service worker lifecycle checks passed');
  }
} catch (error) {
  fail(`Unable to inspect service worker: ${error.message}`);
}

try {
  const reports = await readFile(path.join(root, 'agrismart-reports.js'), 'utf8');
  for (const marker of ['inventoryMovements', 'captureSnapshot', 'restoreSnapshot', 'agrismart:restorecomplete']) {
    if (!reports.includes(marker)) fail(`Backup/restore safeguard missing: ${marker}`);
  }
  pass('Backup and restore safeguards detected');
} catch (error) {
  fail(`Unable to inspect backup module: ${error.message}`);
}

for (const message of passes) console.log(`PASS: ${message}`);
for (const message of failures) console.error(`FAIL: ${message}`);

console.log(`\nValidation summary: ${passes.length} passed, ${failures.length} failed.`);
if (failures.length > 0) process.exit(1);
