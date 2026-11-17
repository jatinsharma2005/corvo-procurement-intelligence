import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: ['../../tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@corvo/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@corvo/policy-schema': path.resolve(__dirname, '../../packages/policy-schema/src')
    }
  }
});
