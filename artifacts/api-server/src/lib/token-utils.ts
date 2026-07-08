export function countTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export const COST_PER_TOKEN = 0.75 / 1_000_000;

export function calcCost(totalTokens: number): number {
  return totalTokens * COST_PER_TOKEN;
}
