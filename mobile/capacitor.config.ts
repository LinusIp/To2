// To2 Android shell: loads the production site. The URL lives ONCE in ../production.json (the release
// script reads the same file); CI checks that <url>/version answers before building.
import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { url } = JSON.parse(readFileSync(join(__dirname, "..", "production.json"), "utf8")) as { url: string };

const config: CapacitorConfig = {
  appId: "uz.to2.app",
  appName: "Ilmobod",
  webDir: "www",
  server: {
    url,
    // shown when the site can't be loaded (no internet): bundled page in www/
    errorPath: "offline.html",
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#2563eb",
  },
};

export default config;
