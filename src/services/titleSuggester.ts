import { callJSON } from "./anthropicClient";

const SYSTEM = `你是 Prompt 起名专家。给定一段提示词正文，输出 JSON：
{"title":"动词+任务对象，6-12 字，概括 Prompt 的作用","summary":"一句话用途，20 字以内"}

要求：
1. title 必须是「概括用途/作用」的总结，禁止照抄正文开头几个字。
2. summary 描述这个 Prompt 能帮用户做什么。
仅输出 JSON。`;

export async function suggestTitle(
  body: string
): Promise<{ title: string; summary: string }> {
  const trimmed = body.trim().slice(0, 1200);
  return callJSON<{ title: string; summary: string }>(SYSTEM, trimmed, 256);
}
