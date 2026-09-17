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
        lines: 24,
        'src/auth/**': { lines: -292 },
        'src/stock/**': { lines: 65 },
        'src/sales/**': { lines: 66 },
        'src/public/**': { lines: 9 },
      },
      reportOnFailure: true,
    },
  },
});
