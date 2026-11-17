// Push-to-talk recorder: MediaRecorder → webm/opus (or mp4 on Safari).
// Recordings are sent to /api/stt and never stored (CLAUDE.md §14 S4).
let stream: MediaStream | null = null;
let rec: MediaRecorder | null = null;
let chunks: Blob[] = [];
let startedAt = 0;

export function micSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function pickMime() {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return opts.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

export async function startRecording(): Promise<void> {
  if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  chunks = [];
  const mimeType = pickMime();
  rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);
  startedAt = performance.now();
}

export function isRecording() {
  return rec?.state === "recording";
}

/** Stop and return the audio. Returns null if shorter than 0.5s (VoiceLab minimum). */
export function stopRecording(): Promise<{ blob: Blob; ms: number } | null> {
  return new Promise((resolve) => {
    if (!rec || rec.state !== "recording") return resolve(null);
    const ms = performance.now() - startedAt;
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec?.mimeType || "audio/webm" });
      chunks = [];
      // release the mic so the browser's "recording" indicator turns off
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      resolve(ms < 500 || blob.size < 800 ? null : { blob, ms });
    };
    rec.stop();
  });
}
