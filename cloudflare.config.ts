import { bindings, defineConfig, defineWorker } from "cf/config";

// Cloudflare bindings for To2.
// NOTE: C3 now scaffolds `cloudflare.config.ts` (the new `cf` config) instead of
// `wrangler.jsonc`. Same bindings as CLAUDE.md §2 — see REPORT.md.
export default defineConfig({
  worker: defineWorker({
    name: "to2",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-17",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*", "!/audio/*", "!/fonts/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ id: "434456ba-b06b-481a-b281-76c4f267f339", name: "to2" }),
      KV: bindings.kv({ id: "32f5698371d8498483830b87b367c689" }),
      // R2 is not enabled on the account yet (code 10042). Audio cache falls back to KV.
      // When R2 is enabled: `pnpm wrangler r2 bucket create to2-audio` and uncomment:
      // AUDIO: bindings.r2({ name: "to2-audio" }),
      MOCK_AI: bindings.text("0"),
      DEFAULT_LOCALE: bindings.text("uz-Latn"),
      VOICELAB_BASE_URL: bindings.text("https://api.voicelab.uz"),
      VOICELAB_LLM_MODEL: bindings.text("aisha-gemma-4"),
      VOICELAB_LANG: bindings.text("uz"),
      // one-off: the team approved the Lola + Ziyo re-warm (~15,400 credits) past the 15k/day cap on this day only
      WARM_CAP_EXEMPT_DAY: bindings.text("2026-11-18"),
      VOICE_IDS: bindings.text(
        JSON.stringify({
          "blokbek": "voice_fa56cecf-9b0b-45ba-9ec3-494efb5b301f",
          "agent-shox": "voice_ba303813-3023-48aa-a454-4b5705669d35",
          "lola": "voice_83a39d68-22bc-4062-b86e-0a9dd998ba7a",
          "ziyo": "voice_5e592ada-eca8-42e3-98fa-469c1c8fc999",
          "sardor": "voice_xdQMoRJkjHbPIB-jounXzKq8",
          "ravshan": "voice_5e592ada-eca8-42e3-98fa-469c1c8fc999",
          "diyorbek": "voice_8bae02c6-d078-4757-9d62-0fce6da23cf7",
          "shadow": "voice_OBuMpAaB5iYCUZS0eCc9Fj3k"
        }),
      ),
      VOICELAB_API_KEY: bindings.secret(),
    },
  }),
});
