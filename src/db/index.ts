import Dexie, { type Table } from "dexie";
import type { Prompt, Context, Scenario, Workflow, SharedTemplate } from "@/types";

export class PromptOSDB extends Dexie {
  prompts!: Table<Prompt, string>;
  contexts!: Table<Context, string>;
  scenarios!: Table<Scenario, string>;
  workflows!: Table<Workflow, string>;
  sharedTemplates!: Table<SharedTemplate, string>;

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
  }
}

export const db = new PromptOSDB();
