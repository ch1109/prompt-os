import { callJSON } from "./anthropicClient";
import type { Prompt } from "@/types";

interface ClassifyResult {
  title: string;
  summary: string;
  taskIntent: string;
  primaryScenario: string[];
  secondaryScenarios: string[][];
  taskType: Prompt["taskType"];
  difficulty: Prompt["difficulty"];
  valueLevel: Prompt["valueLevel"];
  tags: string[];
  inputRequirements: string;
  outputFormat: string;
  boundaries: string;
  confidence: number;
}

const SYSTEM = `你是 Prompt 分类专家。给定一段 Prompt 文本，输出 JSON：
{"title":"动词+任务对象，6-12 字",
"summary":"一句话描述用途",
"taskIntent":"用户调用它要解决的真实问题（一句话）",
"primaryScenario":["一级场景","二级","三级"],
"secondaryScenarios":[["一级","二级","三级"]],
"taskType":"分析|生成|改写|总结|规划|决策|复盘",
"difficulty":"初级|中级|高级",
"valueLevel":"高频|高价值|战略型|辅助型",
"tags":["5-8 个关键词"],
"inputRequirements":"","outputFormat":"","boundaries":"","confidence":0.0}

要求：
1. 一级场景必须从下列十项中选一：工作场景/自媒体场景/学习场景/读书场景/写作场景/商业场景/个人成长场景/生活管理场景/AI工具场景/知识管理场景。
2. primaryScenario 必须有完整三级路径（一级 / 二级 / 三级）。
3. secondaryScenarios 是数组的数组，每条都是同样的三级路径；只在该 Prompt 跨场景时填入 1-2 条，否则为 []。
4. tags 应聚焦关键词（动作、领域、风格），不要重复 primaryScenario 内已出现的词。
5. confidence 是你对整体分类的把握（0-1），低置信度（如多义、文本太短）应给 0.5 以下。

仅输出 JSON，不要解释。`;

export async function classifyOne(body: string): Promise<ClassifyResult> {
  return callJSON<ClassifyResult>(SYSTEM, body, 1024);
}

export async function classifyBatch(
  bodies: string[],
  onProgress: (done: number, total: number) => void,
  concurrency = 3
): Promise<(ClassifyResult & { body: string })[]> {
  const results: (ClassifyResult & { body: string })[] = new Array(bodies.length);
  let done = 0;
  const queue = bodies.map((b, i) => ({ b, i }));

  async function worker() {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        const r = await classifyOne(item.b);
        results[item.i] = { ...r, body: item.b };
      } catch {
        results[item.i] = {
          title: item.b.slice(0, 12),
          summary: "",
          taskIntent: "",
          primaryScenario: [],
          secondaryScenarios: [],
          taskType: "生成",
          difficulty: "初级",
          valueLevel: "辅助型",
          tags: [],
          inputRequirements: "",
          outputFormat: "",
          boundaries: "",
          confidence: 0,
          body: item.b,
        };
      }
      done++;
      onProgress(done, bodies.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
