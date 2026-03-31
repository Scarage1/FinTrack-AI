import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./test-results/vitest-junit.xml"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.js"],
      exclude: [
        "src/initDb.js",
        "src/store.js",
        "prisma/**",
        "test/**"
      ],
      thresholds: {
        statements: 60,
        branches: 45,
        functions: 60,
        lines: 60
      }
    }
  }
});
