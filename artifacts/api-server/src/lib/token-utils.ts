export function countTokens(text: string): number {
  return text.length;
}

export const COST_PER_TOKEN = 1.50 / 1_000_000;

export function calcCost(totalTokens: number): number {
  return totalTokens * COST_PER_TOKEN;
}
