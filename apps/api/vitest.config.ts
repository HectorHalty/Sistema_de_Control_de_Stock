import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'test/db/**'],
    setupFiles: ['test/setup-reflect.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: ['test/**', 'dist/**', 'prisma/**', 'scripts/**'],
      thresholds: {
        lines: 28,
        'src/auth/**': { lines: 0 },
        'src/stock/**': { lines: 67 },
        'src/sales/**': { lines: 74 },
        'src/public/**': { lines: 11 },
      },
      reportOnFailure: true,
    },
  },
});
