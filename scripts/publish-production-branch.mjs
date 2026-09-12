import { cpSync, existsSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const deployDir = resolve(root, 'deploy-aapanel');

// ALWAYS REPACKAGE.
//
// This used to build only when deploy-aapanel/ was missing, which meant the
// second release of the day shipped the first one's code: the directory was
// there, the check passed, and a stale dist went to production carrying the
// commit message of the work it did not contain. A build takes a minute; being
// wrong about what is deployed takes considerably longer.
console.log('==> Building a fresh deploy package...');
execSync('node scripts/package-aapanel.mjs', { cwd: root, stdio: 'inherit' });

const tempDir = join(tmpdir(), `intern-attendance-prod-${randomUUID()}`);
console.log(`==> Staging production branch in isolated environment: ${tempDir}`);

try {
  // 1. Check if production branch exists locally or remotely to preserve history
  let hasProduction = false;
  try {
    execSync('git rev-parse --verify production', { cwd: root, stdio: 'pipe' });
    hasProduction = true;
  } catch {
    try {
      execSync('git rev-parse --verify origin/production', { cwd: root, stdio: 'pipe' });
      execSync('git branch production origin/production', { cwd: root, stdio: 'pipe' });
      hasProduction = true;
    } catch { }
  }

  if (hasProduction) {
    // Clone existing branch with its commit history
    execSync(`git clone --single-branch --branch production "${root.replace(/\\/g, '/')}" "${tempDir}"`, { stdio: 'pipe' });
    // Clean old files while preserving .git
    for (const item of readdirSync(tempDir)) {
      if (item === '.git') continue;
      rmSync(join(tempDir, item), { recursive: true, force: true });
    }
  } else {
    // First time setup only
    mkdirSync(tempDir, { recursive: true });
    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git checkout -b production', { cwd: tempDir, stdio: 'pipe' });
  }

  // 2. Copy fresh deploy package
  cpSync(deployDir, tempDir, { recursive: true });

  // 3. Remove local .env (keep .env.example)
  const localEnv = join(tempDir, '.env');
  if (existsSync(localEnv)) {
    rmSync(localEnv, { force: true });
  }

  // 4. Create production .gitignore
  // THIS IS WHAT KEEPS aaPanel's CHECKOUT CLEAN.
  //
  // The deployed app is a git working tree, and it writes files into its own
  // directory: node_modules from npm install, .env from the operator,
  // first-superadmin.txt on a fresh database, a backup if somebody takes one.
  // Any of those tracked would make `git pull` stop on a local change, on the
  // one machine where stopping is most expensive. They are ignored here so the
  // tree stays exactly what the branch says it is, and every pull is a clean
  // fast-forward.
  const gitignoreContent = `# Production runtime ignores
node_modules/
package-lock.json
.env
.env.*
!.env.example
storage-data/
storage/
data/
*.log
.DS_Store

# Secrets the app and its scripts write beside themselves.
first-superadmin.txt
superadmin-backup.json
superadmin-backup*.json
`;
  writeFileSync(join(tempDir, '.gitignore'), gitignoreContent, 'utf8');

  // 5. Commit with continuous history
  execSync('git config user.name "eslamghazi"', { cwd: tempDir, stdio: 'pipe' });
  execSync('git config user.email "eslamghazi20002@gmail.com"', { cwd: tempDir, stdio: 'pipe' });
  execSync('git add -A', { cwd: tempDir, stdio: 'pipe' });

  const status = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
  if (status) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    execSync(`git commit -m "release: production build ${timestamp}"`, { cwd: tempDir, stdio: 'pipe' });

    console.log('==> Updating local "production" branch with continuous history...');
    if (!hasProduction) {
      execSync(`git remote add target "${root.replace(/\\/g, '/')}"`, { cwd: tempDir, stdio: 'pipe' });
    } else {
      // Remote "origin" inside the clone already points to root
    }
    const remoteName = hasProduction ? 'origin' : 'target';
    execSync(`git push ${remoteName} production:production`, { cwd: tempDir, stdio: 'pipe' });
    console.log('[SUCCESS] Production branch updated linearly (no force push needed)!');
  } else {
    console.log('[INFO] No changes detected in deploy package; production branch is up to date.');
  }
} finally {
  if (existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error in temp
    }
  }
}
