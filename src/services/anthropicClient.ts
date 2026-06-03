import Anthropic from "@anthropic-ai/sdk";
import { useSettings } from "@/store/settingsStore";

export function getClient() {
  const { apiKey } = useSettings.getState();
  if (!apiKey) throw new Error("请先在「设置」中填入 API Key");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/**
 * 从模型输出里稳健提取 JSON：先整体 parse，失败再用括号配平截取首个完整
 * `{...}` / `[...]`（识别字符串内的引号与转义，避免贪婪正则在多段/带解释文本时截错）。
 */
function tryExtractJSON(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    /* 整体不是纯 JSON，转入括号配平提取 */
  }
  const slice = balancedSlice(trimmed);
  if (slice) {
    try {
      return { ok: true, value: JSON.parse(slice) };
    } catch {
      /* 截出的片段仍非法 */
    }
  }
  return { ok: false };
}

/** 从首个 `{` 或 `[` 起按括号深度配平，返回第一个完整的 JSON 子串（识别字符串与转义）。 */
function balancedSlice(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export async function callJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<T> {
  const client = getClient();
  const { model } = useSettings.getState();
  // 解析失败重试一次：模型偶发返回带解释文本或被截断的 JSON。
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const parsed = tryExtractJSON(text);
    if (parsed.ok) return parsed.value as T;
  }
  throw new Error("AI 未返回 JSON");
}
