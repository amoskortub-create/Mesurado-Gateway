import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatCurrency(usd: number): string {
  return `$${usd.toFixed(6)}`;
}

export function countTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export const COST_PER_TOKEN = 0.75 / 1_000_000;

export function calcCost(totalTokens: number): number {
  return totalTokens * COST_PER_TOKEN;
}

export function maskKey(key: string): string {
  if (key.length <= 12) return '••••••••••••';
  return key.slice(0, 20) + '••••••••••••' + key.slice(-4);
}

export function maskKeyPrefix(prefix: string): string {
  return `${prefix}••••••••••••`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
