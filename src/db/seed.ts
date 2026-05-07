import { db } from "./index";
import { nanoid } from "nanoid";

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
