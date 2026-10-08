import { defineConfig } from "vitest/config";

// Brain OS test suite (Phase 0). Runs the *.test.mjs files from tests/ in Node.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    environment: "node",
  },
});
