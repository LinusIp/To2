// Always-on command listening for hands-free mode, with the browser's own speech recogniser
// (Chrome / Android / Edge / Safari: webkitSpeechRecognition, lang uz-UZ). Free and on-device or
// browser-vendor side — no VoiceLab STT credits. Where it is missing, the big mic button records and
// sends the phrase through /api/stt, and the engine's a11y-hook runs it as a command.
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function ctor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const recognitionSupported = () => !!ctor();

/**
 * Listen until stop() is called; every final phrase goes to onText. Restarts itself after the
 * browser's silence timeout. onState reports whether the mic is really open (for the indicator).
 */
export function listenForCommands(onText: (text: string) => void, onState?: (listening: boolean) => void): () => void {
  const C = ctor();
  if (!C) return () => {};
  let active = true;
  let fails = 0;
  let rec: Rec | null = null;
  const begin = () => {
    if (!active) return;
    rec = new C();
    rec.lang = "uz-UZ";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      fails = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal && r[0]?.transcript) onText(r[0].transcript);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") active = false;
      fails++;
    };
    rec.onend = () => {
      onState?.(false);
      if (active && fails < 5) window.setTimeout(begin, 250);
    };
    try {
      rec.start();
      onState?.(true);
    } catch {
      onState?.(false);
    }
  };
  begin();
  return () => {
    active = false;
    try {
      rec?.abort();
    } catch {
      /* already stopped */
    }
    onState?.(false);
  };
}
