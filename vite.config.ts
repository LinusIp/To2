import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { execSync } from "node:child_process";

// Build stamp for /version: which commit is live, and was the tree clean when it was built?
// (scripts/release.mjs builds from a clean checkout of HEAD, so `dirty` should be false in production.)
const git = (cmd: string) => {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};
const BUILD = {
  commit: git("rev-parse HEAD") || "unknown",
  dirty: git("status --porcelain --untracked-files=no") !== "",
  builtAt: new Date().toISOString(),
};

export default defineConfig({
  define: {
    __TO2_BUILD__: JSON.stringify(BUILD),
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
