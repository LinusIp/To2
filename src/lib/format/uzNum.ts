// Uzbek number display: the decimal separator is a comma ("0,5", "3,14"). Display only: values sent to the
// checker stay as generated (it accepts both "0.5" and "0,5"). Games have their own (src/lib/games, #10).

/** "0.5 + 1.25 = ?" → "0,5 + 1,25 = ?". Only a dot BETWEEN two digits changes; "Ha." / "1." / ".5" stay. */
export function uzDecimal(text: string): string {
  return text.replace(/(\d)\.(?=\d)/g, "$1,");
}

/** A number for display with the Uzbek decimal comma (at most `digits` decimals, trailing zeros dropped). */
export function uzNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return String(n);
  return uzDecimal(String(Number(n.toFixed(digits))));
}
