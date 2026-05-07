import { db } from "./index";
import { nanoid } from "nanoid";
import type { Prompt } from "@/types";

const DEFAULT_SCENARIOS = [
  "工作场景",
  "自媒体场景",
  "学习场景",
  "读书场景",
  "写作场景",
  "商业场景",
  "个人成长场景",
  "生活管理场景",
  "AI工具场景",
  "知识管理场景",
];

export async function seedDefaultScenarios() {
  const count = await db.scenarios.count();
  if (count > 0) return;
  await db.scenarios.bulkAdd(
    DEFAULT_SCENARIOS.map((title) => ({
      id: nanoid(),
      title,
      parentId: null,
      level: 1,
      description: "",
      tags: [],
    }))
  );
}

export async function seedPromptsFromFile() {
  const count = await db.prompts.count();
  if (count > 0) return; // 已有数据，跳过

  try {
    const res = await fetch("/seed-prompts.json");
    if (!res.ok) return;
    const data = (await res.json()) as { prompts: Prompt[] };
    if (!data.prompts?.length) return;

    // 分批写入避免单次事务过大
    const CHUNK = 40;
    for (let i = 0; i < data.prompts.length; i += CHUNK) {
      await db.prompts.bulkAdd(data.prompts.slice(i, i + CHUNK));
    }

    console.log(`[Prompt OS] 已从种子文件导入 ${data.prompts.length} 条提示词`);
  } catch (e) {
    console.warn("[Prompt OS] 种子数据加载失败", e);
  }
}
