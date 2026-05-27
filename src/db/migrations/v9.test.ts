import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { db } from "@/db";
import { migrateContextTypesV9 } from "./v9";
import {
  writeMigrationArchive,
  listSnapshots,
  restoreSnapshot,
  __testing,
} from "@/db/snapshot";
import type { Context, ContextType } from "@/types";

const now = () => Date.now();

function makeLegacy(
  id: string,
  type: string,
  isDefault = false,
  extra: Record<string, unknown> = {}
): Context {
  return {
    id,
    title: id,
    type: type as ContextType, // 测试故意注入旧/未知字面量，运行时由 v9 hook 归一
    content: "x",
    tags: [],
    isDefault,
    createdAt: now(),
    updatedAt: now(),
    ...extra,
  };
}

async function runMigration() {
  await db.transaction("rw", db.contexts, async () => {
    await migrateContextTypesV9(Dexie.currentTransaction!);
  });
}

describe("v9 migrateContextTypesV9", () => {
  beforeEach(async () => {
    await db.contexts.clear();
  });

  it("旧 10 类按映射表全部转为新值", async () => {
    const samples: Array<[string, string, string]> = [
      ["c1", "个人背景", "用户背景"],
      ["c2", "职业身份", "用户背景"],
      ["c3", "当前项目", "项目背景"],
      ["c4", "长期目标", "项目背景"],
      ["c5", "输出风格", "风格指南"],
      ["c6", "任务背景", "项目背景"],
      ["c7", "产品介绍", "项目背景"],
      ["c8", "用户画像", "用户背景"],
      ["c9", "品牌信息", "风格指南"],
      ["c10", "常用限制条件", "约束规则"],
    ];
    await db.contexts.bulkAdd(samples.map(([id, type]) => makeLegacy(id, type)));

    await runMigration();

    for (const [id, , expected] of samples) {
      const c = await db.contexts.get(id);
      expect(c?.type).toBe(expected);
    }
  });

  it("isDefault=true 同步为 triggerStrategy=always；false → manual", async () => {
    await db.contexts.bulkAdd([
      makeLegacy("a", "个人背景", true),
      makeLegacy("b", "职业身份", false),
    ]);

    await runMigration();

    const a = await db.contexts.get("a");
    const b = await db.contexts.get("b");
    expect(a?.triggerStrategy).toBe("always");
    expect(b?.triggerStrategy).toBe("manual");
  });

  it("升级后所有条目都补齐 scope=global 与 enabled=true", async () => {
    await db.contexts.bulkAdd([
      makeLegacy("x", "个人背景"),
      makeLegacy("y", "输出风格", true),
    ]);

    await runMigration();

    for (const id of ["x", "y"]) {
      const c = await db.contexts.get(id);
      expect(c?.scope).toBe("global");
      expect(c?.enabled).toBe(true);
    }
  });

  it("已有 triggerStrategy 的条目（v9 之后新建）不被覆盖", async () => {
    await db.contexts.add(
      makeLegacy("z", "个人背景", false, { triggerStrategy: "conditional" })
    );

    await runMigration();

    const after = await db.contexts.get("z");
    expect(after?.triggerStrategy).toBe("conditional");
    // type 仍然按映射表转换
    expect(after?.type).toBe("用户背景");
  });

  it("type 已经是新 9 类之一时保留不变", async () => {
    await db.contexts.bulkAdd([
      makeLegacy("k", "角色人格"),
      makeLegacy("m", "约束规则", true),
    ]);

    await runMigration();

    expect((await db.contexts.get("k"))?.type).toBe("角色人格");
    expect((await db.contexts.get("m"))?.type).toBe("约束规则");
  });

  it("未知 type 兜底为 '自定义'", async () => {
    await db.contexts.add(makeLegacy("u", "不存在的旧类型"));

    await runMigration();

    expect((await db.contexts.get("u"))?.type).toBe("自定义");
  });

  it("空表幂等：不报错、不写入", async () => {
    await runMigration();
    expect(await db.contexts.count()).toBe(0);
  });
});

describe("v9 升级 hook 集成：snapshot 归档 contexts + 重映射", () => {
  beforeEach(async () => {
    await db.contexts.clear();
    await db.prompts.clear();
    await db.scenarios.clear();
    await db.taskPacks.clear();
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(__testing.KEY_PREFIX)) localStorage.removeItem(k);
    }
  });

  it("writeMigrationArchive 携带 contexts → snapshot payload 持久化 contexts", async () => {
    const sample: Context[] = [
      makeLegacy("c1", "个人背景", true),
      makeLegacy("c2", "输出风格"),
    ];

    const entry = writeMigrationArchive({
      prompts: [],
      scenarios: [],
      taskPacks: [],
      contexts: sample,
    });

    expect(entry).not.toBeNull();
    expect(entry?.reason).toBe("migration");
    expect(entry?.counts.contexts).toBe(2);

    const raw = localStorage.getItem(entry!.key);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.contexts).toHaveLength(2);
    expect(parsed.contexts[0].id).toBe("c1");
    expect(parsed.contexts[0].type).toBe("个人背景"); // 归档保留原值
  });

  it("hook 模拟流程：先归档 → 再重映射 → 老 type 不再存在于 contexts 表", async () => {
    // 模拟 hook 步骤 1：把"升级前"的 contexts 灌进去
    const legacy: Context[] = [
      makeLegacy("a", "个人背景", true),
      makeLegacy("b", "品牌信息"),
    ];
    await db.contexts.bulkAdd(legacy);

    // 步骤 2：归档（snapshot 应该拿到老 contexts）
    const all = await db.contexts.toArray();
    writeMigrationArchive({
      prompts: [],
      scenarios: [],
      taskPacks: [],
      contexts: all,
    });

    // 步骤 3：跑映射
    await runMigration();

    // 校验：表里全部是新 type；snapshot 里仍是老 type
    const after = await db.contexts.toArray();
    for (const c of after) {
      expect(["用户背景", "项目背景", "风格指南", "约束规则", "领域知识", "角色人格", "输出规范", "参考样例", "自定义"]).toContain(
        c.type
      );
    }
    const snapshots = listSnapshots();
    expect(snapshots).toHaveLength(1);
    const raw = localStorage.getItem(snapshots[0].key);
    const archived = JSON.parse(raw!).contexts as Context[];
    const archivedTypes = archived.map((c) => c.type);
    expect(archivedTypes).toContain("个人背景");
    expect(archivedTypes).toContain("品牌信息");
  });

  it("回退验证：用归档恢复 → 老 contexts 仍带旧 type（迁移可逆性证据）", async () => {
    const legacy: Context[] = [makeLegacy("rb", "长期目标", true)];
    await db.contexts.bulkAdd(legacy);
    writeMigrationArchive({
      prompts: [],
      scenarios: [],
      taskPacks: [],
      contexts: await db.contexts.toArray(),
    });

    // 跑迁移把 type 改成 "项目背景"
    await runMigration();
    expect((await db.contexts.get("rb"))?.type).toBe("项目背景");

    // 取出 snapshot key，尝试 restore（restoreSnapshot 接受三表，contexts 暂不在 restore 范围内，
    // 但 snapshot payload 中确实保留了 contexts，验证字段存在即可证明归档完整）
    const snap = listSnapshots()[0];
    expect(snap.counts.contexts).toBe(1);

    // 即使 restoreSnapshot 当前不写回 contexts（设计如此，避免覆盖用户数据），
    // payload 仍然完整保留，可手动 import。
    const raw = JSON.parse(localStorage.getItem(snap.key)!);
    expect(raw.contexts[0].type).toBe("长期目标");
    expect(raw.contexts[0].isDefault).toBe(true);

    // 用 restoreSnapshot 不会撤销 type 改动（这是预期）
    await restoreSnapshot(snap.key);
    expect((await db.contexts.get("rb"))?.type).toBe("项目背景");
  });
});
