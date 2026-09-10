import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const message = args.join(' ').trim() || `chore: update project ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`;

console.log('==> Staging all changes...');
execSync('git add -A', { stdio: 'inherit' });

console.log(`==> Committing: "${message}"...`);
try {
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
} catch {
  console.log('==> Nothing to commit, working tree clean.');
}

console.log('==> Pushing to origin main...');
try {
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('\n[SUCCESS] Pushed changes to main branch successfully!');
} catch (err) {
  console.error('\n[ERROR] Failed to push to remote:', err.message);
  process.exit(1);
}
