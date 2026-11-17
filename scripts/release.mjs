// The ONE way to deploy To2 (one deployer — see REPORT.md "Release process").
//
//   node scripts/release.mjs            pull --rebase → tests → push → clean build → deploy → verify /version
//   node scripts/release.mjs --no-push  same, without pushing (e.g. testing the script)
//
// It builds from a clean temporary checkout of HEAD (git worktree), so production is exactly a
// commit: uncommitted files in this folder (art in progress, another session's edits) never ship,
// and /version names the commit that is live. Wrangler uses this machine's `wrangler login`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROD = "https://to2.locallabs-io.workers.dev";
const args = new Set(process.argv.slice(2));
const t0 = Date.now();
const step = (m) => console.log(`\n▶ ${m}  (+${((Date.now() - t0) / 1000).toFixed(0)} s)`);
function run(cmd, a, opts = {}) {
  const r = spawnSync(cmd, a, { stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit", shell: process.platform === "win32", cwd: opts.cwd, encoding: "utf8" });
  if (r.status !== 0 && !opts.allowFail) {
    if (opts.capture) process.stderr.write((r.stdout ?? "") + (r.stderr ?? ""));
    throw new Error(`${cmd} ${a.join(" ")} failed (exit ${r.status})`);
  }
  return (r.stdout ?? "").trim();
}
const git = (...a) => run("git", a, { capture: true });

let wt = "";
try {
  step("git pull --rebase (autostash keeps uncommitted work in this folder)");
  run("git", ["pull", "--rebase", "--autostash", "origin", "main"]);
  const head = git("rev-parse", "HEAD");
  console.log("HEAD", head.slice(0, 7), "—", git("log", "-1", "--format=%s"));

  step("clean checkout of HEAD");
  wt = fs.mkdtempSync(path.join(os.tmpdir(), "to2-release-"));
  run("git", ["worktree", "add", "--detach", wt, head], { capture: true });
  // sharp ships prebuilt binaries; its (unapproved) install hook is not needed
  run("pnpm", ["install", "--frozen-lockfile", "--prefer-offline", "--reporter=silent", "--config.strict-dep-builds=false"], { cwd: wt });

  step("tests");
  run("pnpm", ["vitest", "run"], { cwd: wt });

  if (!args.has("--no-push")) {
    step("git push");
    run("git", ["push", "origin", "HEAD:main"]);
  }

  step("build");
  run("pnpm", ["build"], { cwd: wt, capture: true });

  step("deploy");
  run("node", ["scripts/deploy.mjs"], { cwd: wt });

  step(`verify ${PROD}/version`);
  let live = null;
  for (let i = 0; i < 20; i++) {
    try {
      live = await (await fetch(`${PROD}/version`, { cache: "no-store" })).json();
      if (live.commit === head) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!live || live.commit !== head) throw new Error(`production shows ${live?.commit?.slice(0, 7) ?? "nothing"}, expected ${head.slice(0, 7)}`);
  if (live.dirty) throw new Error("production build is marked dirty — it was not built from a clean checkout");
  console.log(`\n✔ live: ${live.short} (built ${live.builtAt}) — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} catch (e) {
  console.error(`\n✘ release failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  if (wt) {
    spawnSync("git", ["worktree", "remove", "--force", wt], { stdio: "ignore", shell: process.platform === "win32" });
    fs.rmSync(wt, { recursive: true, force: true });
  }
}
