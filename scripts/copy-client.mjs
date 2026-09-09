import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const clientDist = resolve(root, 'ClientApp', 'dist');
const serverPublic = resolve(root, 'server', 'public');
const rootPublic = resolve(root, 'public');

if (!existsSync(clientDist)) {
  console.error('[copy-client] ClientApp/dist not found. Run "npm run build:client" first.');
  process.exit(1);
}

console.log(`[copy-client] Copying ClientApp/dist -> server/public...`);
mkdirSync(serverPublic, { recursive: true });
cpSync(clientDist, serverPublic, { recursive: true });

console.log(`[copy-client] Copying ClientApp/dist -> root/public...`);
mkdirSync(rootPublic, { recursive: true });
cpSync(clientDist, rootPublic, { recursive: true });

console.log(`[copy-client] Done! Frontend is ready to be served by Node.`);

