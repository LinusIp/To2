import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // --expose-gc: the tutor animator test checks that a frame allocates nothing
  test: { include: ["src/**/*.test.ts"], environment: "node", execArgv: ["--expose-gc"] },
});
