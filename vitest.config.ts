import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 打真實外部 API 的測試較慢，放寬預設逾時
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'hooks/**/*.ts'],
      exclude: ['lib/wasm/app_wasm*.js', 'lib/wasm/**/*.d.ts'],
    },
  },
});
