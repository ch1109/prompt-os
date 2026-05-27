/**
 * 轻量 token 估算：
 * - 中文按 1 字符 ≈ 1 token；
 * - 其他字符按 4 字符 ≈ 1 token（与 GPT/Claude tokenizer 经验值接近）。
 *
 * 函数签名稳定，未来想换 tiktoken/js-tiktoken 直接替换实现即可。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chinese = (text.match(/[一-鿿]/g) || []).length;
  const others = text.length - chinese;
  return Math.ceil(chinese + others / 4);
}
