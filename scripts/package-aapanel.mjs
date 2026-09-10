import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'deploy-aapanel');
const zipFile = resolve(root, 'deploy-aapanel.zip');

console.log('==> Preparing aaPanel deployment package...');

// 1. Clean previous build artifact
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
if (existsSync(zipFile)) {
  rmSync(zipFile, { force: true });
}
mkdirSync(outDir, { recursive: true });

// 2. Always run a clean production build to ensure 100% fresh assets
console.log('==> Building fresh production bundles (ClientApp + Server)...');
execSync('npm run clean && npm run build', { cwd: root, stdio: 'inherit' });

const serverDist = resolve(root, 'server', 'dist');

// 3. Copy compiled server dist
console.log('==> Copying compiled server (dist/)...');
cpSync(serverDist, resolve(outDir, 'dist'), { recursive: true });

// 4. Copy prebuilt client assets to public/
console.log('==> Copying prebuilt frontend (public/)...');
cpSync(resolve(root, 'server', 'public'), resolve(outDir, 'public'), { recursive: true });

// 5. Copy database migrations & SQL definitions
console.log('==> Copying database migrations and schemas (db/)...');
cpSync(resolve(root, 'server', 'db'), resolve(outDir, 'db'), { recursive: true });

// 6. Copy utility scripts
console.log('==> Copying utility scripts (scripts/)...');
cpSync(resolve(root, 'server', 'scripts'), resolve(outDir, 'scripts'), { recursive: true });

// 7. Create production package.json for aaPanel
console.log('==> Creating production package.json...');
const serverPkg = JSON.parse(readFileSync(resolve(root, 'server', 'package.json'), 'utf8'));

const prodPkg = {
  name: 'intern-attendance',
  version: '2.0.0',
  private: true,
  type: 'module',
  description: 'Intern Attendance Fullstack System',
  scripts: {
    start: 'node dist/main.js',
    migrate: 'node scripts/migrate.mjs',
    'migrate:status': 'node scripts/migrate.mjs --status',
    'verify:schema': 'node scripts/verify-schema.mjs',
    'seed:superadmin': 'node scripts/seed-superadmin.mjs',
  },
  dependencies: serverPkg.dependencies,
  engines: {
    node: '>=20',
  },
};

writeFileSync(
  resolve(outDir, 'package.json'),
  JSON.stringify(prodPkg, null, 2),
  'utf8'
);

// 7. Copy .env.example
if (existsSync(resolve(root, '.env.example'))) {
  cpSync(resolve(root, '.env.example'), resolve(outDir, '.env.example'));
}

// 8. Copy .env if available
if (existsSync(resolve(root, '.env'))) {
  cpSync(resolve(root, '.env'), resolve(outDir, '.env'));
}

// 9. Copy deployment documentation & nginx config
if (existsSync(resolve(root, 'deploy', 'AAPANEL_NODE_GUIDE.md'))) {
  cpSync(resolve(root, 'deploy', 'AAPANEL_NODE_GUIDE.md'), resolve(outDir, 'AAPANEL_NODE_GUIDE.md'));
}
if (existsSync(resolve(root, 'deploy', 'aapanel-nginx.conf'))) {
  cpSync(resolve(root, 'deploy', 'aapanel-nginx.conf'), resolve(outDir, 'aapanel-nginx.conf'));
}

console.log('==> Creating deploy-aapanel.zip archive...');
try {
  // Use PowerShell Compress-Archive for fast cross-platform zip on Windows
  execSync(
    `powershell -Command "Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipFile}' -Force"`,
    { cwd: root, stdio: 'inherit' }
  );
  console.log(`\n[SUCCESS] aaPanel package ready:`);
  console.log(` - Directory: ${outDir}`);
  console.log(` - ZIP File:  ${zipFile}`);
} catch (err) {
  console.log(`\n[NOTE] Package folder created at ${outDir}. (Zip creation skipped or failed: ${err.message})`);
}

