import { defineConfig } from 'vitest/config';

// Ensure test environment variables are set before modules load env.ts
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://attendance:password@127.0.0.1:5432/attendance';
process.env.APP_JWT_SECRET = process.env.APP_JWT_SECRET || '01234567890123456789012345678901';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['dist/**', 'node_modules/**', 'test/e2e/**'],
    globals: true,
  },
});
