import Anthropic from "@anthropic-ai/sdk";
import { useSettings } from "@/store/settingsStore";

export function getClient() {
  const { apiKey } = useSettings.getState();
  if (!apiKey) throw new Error("请先在「设置」中填入 API Key");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function callJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<T> {
  const client = getClient();
  const { model } = useSettings.getState();
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("AI 未返回 JSON");
  return JSON.parse(match[0]) as T;
}
