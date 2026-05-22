/**
 * 设备指纹（审计用，非强校验）
 *
 * 仅用于在 redemptions 表里标注"这个码是哪台设备核销的"。
 * 非反作弊主防线——主防线是邀请码本身的一次性核销。
 * 用户清浏览器/换设备都会改变指纹，这是预期行为。
 */

let cached: string | null = null;

export async function getFingerprint(): Promise<string> {
  if (cached) return cached;

  const components: string[] = [
    navigator.userAgent,
    navigator.language,
    String(screen.width) + "x" + String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? 0),
    canvasHash(),
  ];

  cached = await sha256Hex(components.join("|"));
  return cached;
}

function canvasHash(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "16px serif";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = "#069";
    ctx.fillText("prompt-os-fp", 2, 2);
    return canvas.toDataURL().slice(-64);
  } catch {
    return "canvas-error";
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
