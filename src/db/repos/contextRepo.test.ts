import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import {
  createContext,
  updateContext,
  getTriggerStrategy,
} from "./contextRepo";
import type { Context } from "@/types";

describe("contextRepo", () => {
  beforeEach(async () => {
    await db.contexts.clear();
  });

  describe("createContext", () => {
    it("最简调用：注入 triggerStrategy/scope/enabled/description 默认值", async () => {
      const c = await createContext({ title: "t", content: "hi" });
      expect(c.id).toBeTruthy();
      expect(c.triggerStrategy).toBe("manual");
      expect(c.scope).toBe("global");
      expect(c.enabled).toBe(true);
      expect(c.description).toBe("");
      expect(c.isDefault).toBe(false);
      expect(c.type).toBe("自定义");
    });

    it("isDefault=true 自动写入 triggerStrategy=always", async () => {
      const c = await createContext({
        title: "t",
        content: "hi",
        isDefault: true,
      });
      expect(c.triggerStrategy).toBe("always");
      expect(c.isDefault).toBe(true);
    });

    it("显式传 triggerStrategy 优先于 isDefault", async () => {
      const c = await createContext({
        title: "t",
        content: "hi",
        isDefault: true,
        triggerStrategy: "conditional",
      });
      expect(c.triggerStrategy).toBe("conditional");
      // triggerStrategy 不是 always，isDefault 由调用方传入保持原值
      expect(c.isDefault).toBe(true);
    });

    it("triggerStrategy=always 时 isDefault 强制为 true", async () => {
      const c = await createContext({
        title: "t",
        content: "hi",
        isDefault: false,
        triggerStrategy: "always",
      });
      expect(c.triggerStrategy).toBe("always");
      expect(c.isDefault).toBe(true);
    });
  });

  describe("updateContext 双向同步", () => {
    it("patch triggerStrategy=always → 同步 isDefault=true", async () => {
      const c = await createContext({ title: "t", content: "hi" });
      await updateContext(c.id, { triggerStrategy: "always" });
      const after = await db.contexts.get(c.id);
      expect(after?.isDefault).toBe(true);
      expect(after?.triggerStrategy).toBe("always");
    });

    it("patch triggerStrategy=manual → 同步 isDefault=false", async () => {
      const c = await createContext({
        title: "t",
        content: "hi",
        isDefault: true,
      });
      await updateContext(c.id, { triggerStrategy: "manual" });
      const after = await db.contexts.get(c.id);
      expect(after?.isDefault).toBe(false);
      expect(after?.triggerStrategy).toBe("manual");
    });

    it("patch isDefault=true 不传 triggerStrategy → 同步 triggerStrategy=always", async () => {
      const c = await createContext({ title: "t", content: "hi" });
      await updateContext(c.id, { isDefault: true });
      const after = await db.contexts.get(c.id);
      expect(after?.triggerStrategy).toBe("always");
      expect(after?.isDefault).toBe(true);
    });

    it("updateContext 自动更新 updatedAt", async () => {
      const c = await createContext({ title: "t", content: "hi" });
      const before = c.updatedAt;
      await new Promise((r) => setTimeout(r, 5));
      await updateContext(c.id, { title: "t2" });
      const after = await db.contexts.get(c.id);
      expect((after?.updatedAt ?? 0) > before).toBe(true);
    });
  });

  describe("getTriggerStrategy 兼容回退", () => {
    it("有 triggerStrategy 时直接返回", () => {
      const c = {
        triggerStrategy: "conditional",
        isDefault: false,
      } as unknown as Context;
      expect(getTriggerStrategy(c)).toBe("conditional");
    });
    it("缺 triggerStrategy 且 isDefault=true → always", () => {
      const c = { isDefault: true } as unknown as Context;
      expect(getTriggerStrategy(c)).toBe("always");
    });
    it("缺 triggerStrategy 且 isDefault=false → manual", () => {
      const c = { isDefault: false } as unknown as Context;
      expect(getTriggerStrategy(c)).toBe("manual");
    });
  });
});
