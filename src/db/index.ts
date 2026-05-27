import Dexie, { type Table } from "dexie";
import type { Prompt, Context, Scenario, Workflow, SharedTemplate, TaskPack } from "@/types";
import { migratePromptScenarios } from "./migrations/v3";
import { deleteNonPromptEntries } from "./migrations/v5";
import { migrateContextTypesV9 } from "./migrations/v9";
import { writeMigrationArchive } from "./snapshot";

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
        // 铁律：destructive 升级前必须把现状归档到 localStorage，再清表。
        // 归档失败不阻塞升级，但会留下控制台 warn，便于事后排查。
        try {
          const [prompts, scenarios, taskPacks] = await Promise.all([
            tx.table<Prompt>("prompts").toArray(),
            tx.table<Scenario>("scenarios").toArray(),
            tx.table<TaskPack>("taskPacks").toArray(),
          ]);
          writeMigrationArchive({ prompts, scenarios, taskPacks });
        } catch (e) {
          console.warn("[Prompt OS] v7 升级归档失败（继续清表）", e);
        }
        await tx.table("prompts").clear();
        await tx.table("scenarios").clear();
        await tx.table("taskPacks").clear();
      });

    // v8：为 TaskPack 增加 order 字段。原先按 updatedAt 倒序展示，
    //     迁移时按相同顺序赋 order = i*10，保留升级前用户看到的顺序，
    //     之后改由 order 升序排，"重命名跳顶"的现象就此消除。
    //     stores 不变（order 仅做内存排序，不需要索引）。非 destructive，无需 archive。
    this.version(8)
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
        const all = await tx.table<TaskPack>("taskPacks").toArray();
        const byScene = new Map<string, TaskPack[]>();
        for (const p of all) {
          const arr = byScene.get(p.sceneCategoryId) ?? [];
          arr.push(p);
          byScene.set(p.sceneCategoryId, arr);
        }
        const patches: TaskPack[] = [];
        for (const arr of byScene.values()) {
          arr.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          arr.forEach((p, i) => patches.push({ ...p, order: i * 10 }));
        }
        if (patches.length) await tx.table("taskPacks").bulkPut(patches);
      });

    // v9：ContextType 联合完全替换为新 9 类；同时为所有 contexts 补 triggerStrategy / scope / enabled 默认值。
    //     destructive 升级前严格归档：把旧 contexts 全量写入 localStorage（reason="migration"），
    //     失败仅 warn 不阻塞。stores schema 不变（新字段不参与索引）。
    this.version(9)
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
        try {
          const contexts = await tx.table<Context>("contexts").toArray();
          writeMigrationArchive({
            prompts: [],
            scenarios: [],
            taskPacks: [],
            contexts,
          });
        } catch (e) {
          console.warn("[Prompt OS] v9 升级归档失败（继续迁移）", e);
        }
        await migrateContextTypesV9(tx);
      });
  }
}

export const db = new PromptOSDB();
