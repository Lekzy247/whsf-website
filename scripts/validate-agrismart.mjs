import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];

const pass = message => passes.push(message);
const fail = message => failures.push(message);
const exists = async filePath => {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const requiredFiles = [
  'agrismart-final-app.js',
  'agrismart-reports.js',
  'agrismart-inventory.js',
  'sync-manager.js',
  'sync-integration.js',
  'cloud-sync-provider.js',
  'service-worker.js',
  'register-service-worker.js',
  'vercel.json',
  'docs/AGRISMART-RELEASE-CHECKLIST.md'
];

for (const file of requiredFiles) {
  if (await exists(path.join(root, file))) pass(`Required file exists: ${file}`);
  else fail(`Missing required file: ${file}`);
}

const rootEntries = await readdir(root, { withFileTypes: true });
const javascriptFiles = rootEntries
  .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
  .map(entry => entry.name)
  .sort();
const allHtmlFiles = rootEntries
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name)
  .sort();

// Validate the AgriSmart application entry point instead of unrelated legacy pages.
// Fall back to all root HTML files only when app.html is not present.
const htmlFiles = allHtmlFiles.includes('app.html') ? ['app.html'] : allHtmlFiles;

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
  if (await exists(path.join(root, candidate))) {
    manifestPath = candidate;
    break;
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
      for (const icon of manifest.icons) {
        if (!icon?.src || /^(?:https?:|data:)/i.test(icon.src)) continue;
        const iconPath = path.resolve(root, icon.src.replace(/^\//, ''));
        if (!(await exists(iconPath))) fail(`PWA manifest icon does not exist: ${icon.src}`);
      }
      pass(`PWA manifest valid: ${manifestPath}`);
    }
  } catch (error) {
    fail(`Invalid PWA manifest ${manifestPath}: ${error.message}`);
  }
} else {
  fail('No PWA manifest found (manifest.json or manifest.webmanifest)');
}

if (htmlFiles.length === 0) {
  fail('No root HTML entry page found');
} else {
  let manifestLinked = false;
  let appScriptLinked = false;

  for (const file of htmlFiles) {
    const html = await readFile(path.join(root, file), 'utf8');
    const localReferences = [
      ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
      ...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)
    ].map(match => match[1]);

    for (const reference of localReferences) {
      if (/^(?:https?:|data:|mailto:|tel:|#|\/\/)/i.test(reference)) continue;
      const cleanReference = reference.split(/[?#]/)[0];
      if (!cleanReference) continue;
      const referencedPath = path.resolve(path.dirname(path.join(root, file)), cleanReference.replace(/^\//, ''));
      if (!(await exists(referencedPath))) fail(`${file} references a missing local asset: ${reference}`);
      if (cleanReference.endsWith('agrismart-final-app.js')) appScriptLinked = true;
      if (manifestCandidates.some(candidate => cleanReference.endsWith(candidate))) manifestLinked = true;
    }

    pass(`Local HTML asset references checked: ${file}`);
  }

  if (!appScriptLinked) fail('AgriSmart entry page does not reference agrismart-final-app.js');
  if (manifestPath && !manifestLinked) fail(`AgriSmart entry page does not link the PWA manifest: ${manifestPath}`);
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
  const safeguards = ['inventoryMovements', 'captureSnapshot', 'restoreSnapshot', 'agrismart:restorecomplete'];
  const missingSafeguards = safeguards.filter(marker => !reports.includes(marker));
  for (const marker of missingSafeguards) fail(`Backup/restore safeguard missing: ${marker}`);
  if (missingSafeguards.length === 0) pass('Backup and restore safeguards detected');
} catch (error) {
  fail(`Unable to inspect backup module: ${error.message}`);
}

try {
  const vercel = JSON.parse(await readFile(path.join(root, 'vercel.json'), 'utf8'));
  if (!Array.isArray(vercel.headers)) {
    fail('vercel.json must define a headers array');
  } else {
    const headerRules = new Map(vercel.headers.map(rule => [rule.source, rule.headers || []]));
    const globalHeaders = new Map((headerRules.get('/(.*)') || []).map(header => [header.key.toLowerCase(), header.value]));
    for (const key of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security']) {
      if (!globalHeaders.has(key)) fail(`Global deployment header missing: ${key}`);
    }

    const serviceWorkerHeaders = new Map((headerRules.get('/service-worker.js') || []).map(header => [header.key.toLowerCase(), header.value]));
    if (!/max-age=0/i.test(serviceWorkerHeaders.get('cache-control') || '')) {
      fail('service-worker.js must be configured for immediate cache revalidation');
    }
    if (serviceWorkerHeaders.get('service-worker-allowed') !== '/') {
      fail('service-worker.js must allow root scope');
    }

    const availableManifestRule = manifestCandidates.find(candidate => headerRules.has(`/${candidate}`));
    if (!availableManifestRule) {
      fail('No deployment header rule found for a PWA manifest');
    } else {
      const manifestHeaders = new Map((headerRules.get(`/${availableManifestRule}`) || []).map(header => [header.key.toLowerCase(), header.value]));
      if (!/application\/manifest\+json/i.test(manifestHeaders.get('content-type') || '')) {
        fail(`${availableManifestRule} must use the application/manifest+json content type`);
      }
    }

    pass('Vercel deployment configuration checked');
  }
} catch (error) {
  fail(`Invalid or unreadable vercel.json: ${error.message}`);
}

for (const message of passes) console.log(`PASS: ${message}`);
for (const message of failures) console.error(`FAIL: ${message}`);

console.log(`\nValidation summary: ${passes.length} passed, ${failures.length} failed.`);
if (failures.length > 0) process.exit(1);
