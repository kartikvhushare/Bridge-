/* separate config so the audit dump can run on demand without living in the normal suite */
import { defineConfig } from 'vite';
export default defineConfig({
  test: {
    root: '.',
    environment: 'jsdom',
    setupFiles: ['./tests/_env.js'],
    include: ['work/mobile-audit/dump.test.js'],
    exclude: ['**/node_modules/**'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
});
