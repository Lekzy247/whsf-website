import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', '.vercel', 'dist', 'build', 'coverage']);
const ignoredFiles = new Set(['scripts/scan-secrets.mjs']);
const textExtensions = new Set([
  '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.yml', '.yaml',
  '.txt', '.xml', '.svg', '.toml', '.ini', '.properties', '.sh', '.ps1'
]);

const secretPatterns = [
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{30,255}\b/g],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{50,255}\b/g],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ['Stripe live secret key', /\bsk_live_[A-Za-z0-9]{20,}\b/g]
];

const findings = [];
const scannedFiles = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.isDirectory() && entry.name !== '.github') continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, '/');

    if (entry.isDirectory()) {
      await walk(absolutePath);
      continue;
    }

    if (ignoredFiles.has(relativePath)) continue;
    if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
      findings.push({ file: relativePath, line: 1, type: 'Committed environment file' });
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!textExtensions.has(extension)) continue;

    const fileStats = await stat(absolutePath);
    if (fileStats.size > 1_000_000) continue;

    const content = await readFile(absolutePath, 'utf8');
    scannedFiles.push(relativePath);
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.includes('secret-scan: allow')) continue;
      for (const [type, pattern] of secretPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) findings.push({ file: relativePath, line: index + 1, type });
      }
    }
  }
}

await walk(root);

if (findings.length > 0) {
  console.error(`Secret scan failed with ${findings.length} potential credential finding(s):`);
  for (const finding of findings) {
    console.error(`- ${finding.type}: ${finding.file}:${finding.line}`);
  }
  console.error('Remove the credential, rotate it if real, or add an inline secret-scan: allow comment only for verified test data.');
  process.exit(1);
}

console.log(`Secret scan passed: ${scannedFiles.length} text file(s) checked.`);
