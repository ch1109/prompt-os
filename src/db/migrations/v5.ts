import type { Transaction } from "dexie";

/**
 * v5 升级：硬删除 32 条"明显不是 prompt"的条目。
 * 标准：标题碎片 / 推文流水账 / 教程方法论散文 / 完全重复 / 工具内置 prompt。
 * 删除后从 196 → 164 条。
 */
const DELETE_IDS: string[] = [
  // 标题碎片
  "1jdGf7O2lGiBn7Z4-8eI9", // 「1.」
  "EBRohcUY-6_BpA4irIP7G", // 「第一个技巧：」
  "fcQFhz8InhAQRgW7riF8y", // 「二、实战智慧萃取版」
  "3XH6ENcgtVL_GYWXGZKQK", // 「Mission」
  "6yNa6YZPEq3hoUrv5JN-2", // 「Roles：」
  "aAREA2pDV8kfRWpRzd278", // 「目标：[具体要求]」

  // 推文 / 流水账
  "l5xEbVvf2qdQrZs0a1BmK", // 昨天发了网页杂志的提示词
  "Au1MD0ZoikzYDnPu7HrJy", // 编程小白开发 LLM Prompt 管理插件
  "5r2JGDAHT3b6CvjvUZVPl", // 我操，这是 AI 一次性能搞定的东西啊
  "d11T3sIiqpu8sa97RLACQ", // cursor Claude 3.7 生成 html 交互稿
  "Cd2J7UGVKDt7JzrZSh5fg", // 发一条卖了五位数的 Prompt

  // 完全重复
  "k8ggbpkalCEprvjVxH0Zf", // 提示词模板（重复，保留 nP21E9L-aYIt4t4Zn2XLc）
  "HMLBd4g92Xjro5oe7CGbE", // Prompt 忽略政治正确（重复，保留 HUQFMTPOMi7qsAwXIC3qO）

  // 教程 / 方法论散文
  "R7Czhx45yPUHR0x6_Lapw", // 长上下文指令的三个核心策略
  "wRCJTzyOUjwteOky7_Rsl", // 100 个用 AI 高效学习的「邪修」技巧
  "2Ae2W21TzVYCSzJTdGSNR", // 成为最会使用 AI 来学习的人
  "TxXJqjTQ3FBWRwRsNRlaT", // 用 AI 提升各维度能力 100 条干货
  "1a0wWOXnTto_PO2STeQAX", // 反向工程：专家通常会逆向思考
  "X1KbFOziDikHOdM5PFWGx", // 如何把脑中的想法变成优秀的 AI 描述
  "E-YuBM5jDYc0-WcXfGc24", // 我想稍微反驳一下
  "HG6F6PUNhrohSh5WIXb_m", // 第一层：角色定位 (Who)
  "jtD9mUdcp_jUKaZuOjJsT", // 元提示可以明确要求 AI 按特定步骤思考
  "QKh240jFi1kGfP_Orhzix", // 隐性事实查询 (Implicit Fact Queries)
  "-Seqx7pgqnCti8L2Yqmtr", // 1、强调思维过程
  "W__k_FHjw9cQkfjPJcNEo", // 优秀 Prompt 工程师的关键能力
  "bgwu5rwc8wbYpvS0tFu7N", // 逆向生成学习路径 80/20
  "SFPzcHiWDT4tlvwpz1hRz", // 模型犯错时直接问模型
  "3RNjOu1hwKpifVw5r4vmo", // 指令模板（最终目标 + 工具）
  "MAO6_O-KSpBIt65_PLGGB", // 1、我希望回答详尽深入
  "W52Jpcuk3pauQ8pDDcWc5", // ai 写业务提示词工作流

  // 工具内置 prompt
  "ChMWWGB8XChx3B147Hqvl", // bolt.new 内置 Prompt
];

export async function deleteNonPromptEntries(tx: Transaction) {
  const promptsTable = tx.table("prompts");
  const before = await promptsTable.count();
  await promptsTable.bulkDelete(DELETE_IDS);
  const after = await promptsTable.count();
  console.log(
    `[Prompt OS v5] 已硬删除 ${before - after} 条非 prompt 条目（剩余 ${after}）`
  );
}
