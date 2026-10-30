import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests don't need the dev-server API or .env.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
