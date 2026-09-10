import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const deployDir = resolve(root, 'deploy-aapanel');

console.log('==> Ensuring fresh deploy package exists...');
if (!existsSync(deployDir) || !existsSync(join(deployDir, 'dist')) || !existsSync(join(deployDir, 'public'))) {
  execSync('node scripts/package-aapanel.mjs', { cwd: root, stdio: 'inherit' });
}

const tempDir = join(tmpdir(), `intern-attendance-prod-${randomUUID()}`);
console.log(`==> Staging production branch in isolated environment: ${tempDir}`);

try {
  // 1. Copy deploy files
  cpSync(deployDir, tempDir, { recursive: true });

  // 2. Remove sensitive local .env (keep .env.example)
  const localEnv = join(tempDir, '.env');
  if (existsSync(localEnv)) {
    rmSync(localEnv, { force: true });
  }

  // 3. Create production .gitignore
  const gitignoreContent = `# Production runtime ignores
node_modules/
.env
.env.*
!.env.example
storage-data/
*.log
.DS_Store
`;
  writeFileSync(join(tempDir, '.gitignore'), gitignoreContent, 'utf8');

  // 4. Initialize git and commit in temporary directory
  execSync('git init', { cwd: tempDir, stdio: 'pipe' });
  execSync('git config user.name "Deployment Agent"', { cwd: tempDir, stdio: 'pipe' });
  execSync('git config user.email "deploy@interns.local"', { cwd: tempDir, stdio: 'pipe' });
  execSync('git checkout -b production', { cwd: tempDir, stdio: 'pipe' });
  execSync('git add -A', { cwd: tempDir, stdio: 'pipe' });
  
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  execSync(`git commit -m "release: production build ${timestamp}"`, { cwd: tempDir, stdio: 'pipe' });

  // 5. Push production branch back to main repository without affecting current working tree
  console.log('==> Updating local "production" branch...');
  execSync(`git remote add target "${root.replace(/\\/g, '/')}"`, { cwd: tempDir, stdio: 'pipe' });
  execSync('git push -f target production:production', { cwd: tempDir, stdio: 'pipe' });

  console.log('\n[SUCCESS] Production branch created/updated successfully!');
  console.log('You can inspect it with:');
  console.log('  git log production -n 1');
  console.log('To push to your remote repository:');
  console.log('  git push -u origin production');
} finally {
  if (existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error in temp
    }
  }
}
