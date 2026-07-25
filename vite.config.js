import { defineConfig } from 'vite';

export default defineConfig({
  // Behavior-preserving split of the single-file app: modules attach their
  // globals to window; nothing here may change runtime semantics.
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/_env.js'],
    // R26: work/mobile-audit/dump.test.js is an audit harness (it renders every route to disk for
    // the headless-Chrome layout pass), not a behaviour test — keep it out of the normal suite.
    exclude: ['**/node_modules/**', '**/dist/**', 'work/**'],
    // the app modules share one window; run test files sequentially in one thread
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } }
  }
});
