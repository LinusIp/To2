// Per-device UI preferences (sound on/off etc.). localStorage can be blocked → safe defaults.
export function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(`to2-pref:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(`to2-pref:${key}`, value);
  } catch {
    /* ignore */
  }
}
