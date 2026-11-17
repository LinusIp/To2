// Deploy the vinext build output with Wrangler.
// Why: C3's `vinext-cloudflare deploy` uses the new `cf` CLI login; this machine is
// logged in with `wrangler login`. We translate the build's worker.config.json
// into a wrangler config and run `wrangler deploy` on the prebuilt bundle.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const out = ".cloudflare/output/v0/workers/default";
const cfg = JSON.parse(fs.readFileSync(path.join(out, "worker.config.json"), "utf8"));
const w = {
  name: cfg.name,
  main: path.posix.join("..", out.replace(".cloudflare/", ""), "bundle", cfg.manifest.mainModule),
  compatibility_date: cfg.compatibilityDate,
  compatibility_flags: cfg.compatibilityFlags,
  no_bundle: true,
  find_additional_modules: true,
  base_dir: path.posix.join("..", out.replace(".cloudflare/", ""), "bundle"),
  rules: [{ type: "ESModule", globs: ["**/*.js", "**/*.mjs"], fallthrough: true }],
  assets: {
    directory: path.posix.join("..", out.replace(".cloudflare/", ""), "assets"),
    binding: "ASSETS",
    html_handling: cfg.assets.htmlHandling,
    not_found_handling: cfg.assets.notFoundHandling,
    run_worker_first: cfg.assets.runWorkerFirst,
  },
  d1_databases: [],
  kv_namespaces: [],
  r2_buckets: [],
  vars: {},
  observability: { enabled: true },
};
for (const [k, b] of Object.entries(cfg.env)) {
  if (b.type === "d1") w.d1_databases.push({ binding: k, database_name: b.name, database_id: b.id, migrations_dir: "../../drizzle" });
  else if (b.type === "kv") w.kv_namespaces.push({ binding: k, id: b.id });
  else if (b.type === "r2") w.r2_buckets.push({ binding: k, bucket_name: b.name });
  else if (b.type === "text") w.vars[k] = b.value;
  else if (b.type === "json") w.vars[k] = b.value;
}
fs.mkdirSync(".cloudflare/deploy", { recursive: true });
const file = ".cloudflare/deploy/wrangler.json";
fs.writeFileSync(file, JSON.stringify(w, null, 2));
console.log("wrote", file);
if (process.argv.includes("--config-only")) process.exit(0);
const r = spawnSync("pnpm", ["wrangler", "deploy", "-c", file], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
