import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            // The `obsidian` package ships types only; tests use a small stub.
            { find: /^obsidian$/, replacement: fromRoot('./test/mocks/obsidian.ts') },
            // Matches the `baseUrl: "."` imports used in the source ("src/settings", ...).
            { find: /^src\//, replacement: `${fromRoot('./src')}/` },
        ],
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./test/setup.ts'],
        include: ['test/**/*.test.ts'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            reporter: ['text', 'html', 'json-summary', 'json'],
            thresholds: {
                // Test strategy, section 4.2: pure modules at 90 percent or better.
                'src/utils/tagUtils.ts': { lines: 90, branches: 90, functions: 90, statements: 90 },
                'src/utils/backup.ts': { lines: 90, branches: 90, functions: 90, statements: 90 },
                'src/utils/tooltipUtils.ts': { lines: 90, branches: 90, functions: 90, statements: 90 },
                'src/settings.ts': { lines: 90, branches: 90, functions: 90, statements: 90 },
            },
        },
    },
});
