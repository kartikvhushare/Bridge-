import { defineConfig } from 'vite';

export default defineConfig({
  // Behavior-preserving split of the single-file app: modules attach their
  // globals to window; nothing here may change runtime semantics.
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/_env.js'],
    // the app modules share one window; run test files sequentially in one thread
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } }
  }
});
