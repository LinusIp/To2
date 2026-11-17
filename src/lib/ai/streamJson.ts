// Incrementally pull complete segment objects out of a streaming JSON array,
// so the first segment can be spoken while the LLM is still writing the rest.
// Emits objects whose parent is an array and which are not nested in another emitted object
// (works for `[ {...}, {...} ]` and `{"segments":[ {...} ]}`; board items inside a segment are skipped).
export function createObjectSplitter() {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let capturing = false;
  let captureDepth = 0;
  let buf = "";

  return function push(chunk: string): string[] {
    const out: string[] = [];
    for (const ch of chunk) {
      if (capturing) buf += ch;
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        continue;
      }
      if (ch === "{" || ch === "[") {
        if (ch === "{" && !capturing && stack[stack.length - 1] === "[") {
          capturing = true;
          captureDepth = stack.length;
          buf = "{";
        }
        stack.push(ch);
      } else if (ch === "}" || ch === "]") {
        stack.pop();
        if (capturing && ch === "}" && stack.length === captureDepth) {
          out.push(buf);
          capturing = false;
          buf = "";
        }
      }
    }
    return out;
  };
}
