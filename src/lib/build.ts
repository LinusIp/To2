// Build stamp injected by vite.config.ts (`define`): commit hash, dirty flag, build time.
declare const __TO2_BUILD__: { commit: string; dirty: boolean; builtAt: string } | undefined;

export const BUILD =
  typeof __TO2_BUILD__ !== "undefined" ? __TO2_BUILD__ : { commit: "dev", dirty: true, builtAt: new Date(0).toISOString() };
