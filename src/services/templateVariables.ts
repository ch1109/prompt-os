/**
 * Prompt 模板变量解析工具
 *
 * 约定：
 * - 变量语法：{{变量名}}、{变量名}、【变量名】或 [变量名]（首尾空格容忍）
 * - 变量名允许中文/英文/数字/下划线/空格等说明性文字，首字符不能是空白、括号或常见 JSON 标点
 * - 同一变量出现多次按首次出现保序，去重
 * - 嵌套 `{{a{{b}}c}}` 取内层 `b`（已知降级）
 * - render 时未提供值的变量保留原 token 不替换
 * - v1 不支持转义
 */

const SLOT_RE = /\{\{\s*([^\s{}[\]【】"'`:：,，][^{}]*?)\s*\}\}|(?<!\{)\{\s*([^\s{}[\]【】"'`:：,，][^{}]*?)\s*\}(?!\})|【\s*([^\s{}[\]【】"'`:：,，][^【】]*?)\s*】|(?<!!)\[\s*([^\s{}[\]【】"'`:：,，][^[\]]*?)\s*\](?!\()/g;

function normalizeSlotName(
  doubleRaw: string | undefined,
  singleRaw: string | undefined,
  fullwidthRaw: string | undefined,
  squareRaw: string | undefined
): string {
  return (doubleRaw ?? singleRaw ?? fullwidthRaw ?? squareRaw ?? "").trim();
}

export function extractVariables(body: string): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of body.matchAll(SLOT_RE)) {
    const name = normalizeSlotName(m[1], m[2], m[3], m[4]);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

export function renderTemplate(
  body: string,
  values: Record<string, string>
): string {
  if (!body) return "";
  return body.replace(
    SLOT_RE,
    (
      full,
      doubleRaw: string | undefined,
      singleRaw: string | undefined,
      fullwidthRaw: string | undefined,
      squareRaw: string | undefined
    ) => {
      const name = normalizeSlotName(doubleRaw, singleRaw, fullwidthRaw, squareRaw);
      if (!name) return full;
      const value = values[name];
      if (value == null || value === "") return full;
      return value;
    }
  );
}

export function isLongValue(value: string): boolean {
  if (!value) return false;
  return value.length > 80 || value.includes("\n");
}
