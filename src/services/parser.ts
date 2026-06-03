/**
 * 去掉条目首部的混乱编号/项目符号前缀：`1. ` `1、` `(1)` `①` `- ` 及残留 `###`。
 * 注意：`数字.` 必须跟空格才剥离（避免误吃 `1.5` 这类小数开头）；中文顿号「、」、
 * 圆括号、圆圈数字允许无空格（中文列表常无空格）。
 */
function stripLeadingNumbering(s: string): string {
  return s.replace(
    /^\s*(?:#{1,6}\s*)?(?:\d+\.[ \t]+|\d+[、)]\s*|\(\d+\)\s*|[①-⑩]\s*|[-*•][ \t]+)/,
    ""
  );
}

/** 折叠 3 个及以上连续换行为一个空行，顺带 trim。 */
function collapseBlankLines(s: string): string {
  return s.replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

function clean(s: string): string {
  return collapseBlankLines(stripLeadingNumbering(s.trim()));
}

export function splitPrompts(raw: string): string[] {
  const parts = raw.includes("###")
    ? raw.split(/###[^\n]*\n/)
    : raw.split(/\n\s*\n/);
  return parts.map(clean).filter(Boolean);
}
