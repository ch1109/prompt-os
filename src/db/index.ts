import Dexie, { type Table } from "dexie";
import type { Prompt, Context, Scenario, Workflow, SharedTemplate, TaskPack } from "@/types";
import { migratePromptScenarios } from "./migrations/v3";
import { deleteNonPromptEntries } from "./migrations/v5";

export class PromptOSDB extends Dexie {
  prompts!: Table<Prompt, string>;
  contexts!: Table<Context, string>;
  scenarios!: Table<Scenario, string>;
  workflows!: Table<Workflow, string>;
  sharedTemplates!: Table<SharedTemplate, string>;
  taskPacks!: Table<TaskPack, string>;

  constructor() {
    super("prompt_os");
    this.version(1).stores({
      prompts:
        "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
      contexts: "id, title, type, isDefault, *tags, updatedAt",
      scenarios: "id, parentId, level, title",
      workflows: "id, title, *tags, updatedAt",
      sharedTemplates: "id, createdAt",
    });

    // v2：场景树升级到三级，新增 fullPath 索引；旧 scenarios 一级数据清空待重 seed
    this.version(2)
      .stores({
        prompts:
          "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
        contexts: "id, title, type, isDefault, *tags, updatedAt",
        scenarios: "id, parentId, level, title, *fullPath",
        workflows: "id, title, *tags, updatedAt",
        sharedTemplates: "id, createdAt",
      })
      .upgrade(async (tx) => {
        await tx.table("scenarios").clear();
      });

    // v3：第一次按粗粒度路径表迁移，已被 v4 取代（保留版本号让 dexie 顺序升级）
    this.version(3)
      .stores({
        prompts:
          "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
        contexts: "id, title, type, isDefault, *tags, updatedAt",
        scenarios: "id, parentId, level, title, *fullPath",
        workflows: "id, title, *tags, updatedAt",
        sharedTemplates: "id, createdAt",
      })
      .upgrade(async (tx) => {
        await tx.table("scenarios").clear();
      });

    // v4：按 prompt id 手工逐条审核分类，覆盖 v3 的粗映射结果
    this.version(4)
      .stores({
        prompts:
          "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
        contexts: "id, title, type, isDefault, *tags, updatedAt",
        scenarios: "id, parentId, level, title, *fullPath",
        workflows: "id, title, *tags, updatedAt",
        sharedTemplates: "id, createdAt",
      })
      .upgrade(async (tx) => {
        await migratePromptScenarios(tx);
        await tx.table("scenarios").clear();
      });

    // v5：硬删除 32 条非 prompt 条目（标题碎片 / 推文 / 教程散文 / 重复）
    this.version(5)
      .stores({
        prompts:
          "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
        contexts: "id, title, type, isDefault, *tags, updatedAt",
        scenarios: "id, parentId, level, title, *fullPath",
        workflows: "id, title, *tags, updatedAt",
        sharedTemplates: "id, createdAt",
      })
      .upgrade(async (tx) => {
        await deleteNonPromptEntries(tx);
        await tx.table("scenarios").clear();
      });

    // v6：Workflow 概念由 TaskPack 取代；归档老用户 workflows 数据后清空，新增 taskPacks 表
    this.version(6)
      .stores({
        prompts:
          "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
        contexts: "id, title, type, isDefault, *tags, updatedAt",
        scenarios: "id, parentId, level, title, *fullPath",
        workflows: "id, title, *tags, updatedAt",
        sharedTemplates: "id, createdAt",
        taskPacks:
          "id, sceneCategoryId, *tags, isFavorited, lastUsedAt, useCount, updatedAt",
      })
      .upgrade(async (tx) => {
        const existing = await tx.table("workflows").toArray();
        if (existing.length > 0 && typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(
              "prompt-os-workflows-archive-v5",
              JSON.stringify(existing)
            );
          } catch {
            // localStorage 写入失败不阻塞迁移
          }
        }
        await tx.table("workflows").clear();
      });

    // v7：以 PromptOS v3.1 提示词集为出厂内容。清空 prompts/scenarios/taskPacks，
    //     由 seedPromptOSV31() 在启动时按 18 场景 + 87 任务包重建；contexts 不动以保护用户自定义上下文。
    this.version(7)
      .stores({
        prompts:
          "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
        contexts: "id, title, type, isDefault, *tags, updatedAt",
        scenarios: "id, parentId, level, title, *fullPath",
        workflows: "id, title, *tags, updatedAt",
        sharedTemplates: "id, createdAt",
        taskPacks:
          "id, sceneCategoryId, *tags, isFavorited, lastUsedAt, useCount, updatedAt",
      })
      .upgrade(async (tx) => {
        await tx.table("prompts").clear();
        await tx.table("scenarios").clear();
        await tx.table("taskPacks").clear();
      });
  }
}

export const db = new PromptOSDB();
