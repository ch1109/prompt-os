export function splitPrompts(raw: string): string[] {
  if (raw.includes("###")) {
    return raw.split(/###[^\n]*\n/).map((s) => s.trim()).filter(Boolean);
  }
  return raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
}
