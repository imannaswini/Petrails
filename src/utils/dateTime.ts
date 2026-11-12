import { useEffect, useState } from 'react';

/**
 * Parse a backend UTC ISO 8601 timestamp safely.
 * Returns null if the string cannot be parsed into a valid Date.
 */
export function parseUtcTimestamp(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'just now') return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Format a UTC ISO 8601 timestamp into the user's local timezone
 * (e.g. "11 Nov 2026, 10:30 PM" in Asia/Kolkata).
 */
export function formatExactLocalDateTime(value?: string | null): string {
  const date = parseUtcTimestamp(value);
  if (!date) return value || '—';

  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);

  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${datePart}, ${timePart}`;
}

/**
 * Format an assessment timestamp dynamically as a relative age (< 24h)
 * or local formatted date-time (>= 24h), reacting to live clock ticks.
 */
export function formatRelativeOrLocalTimestamp(
  value?: string | null,
  nowMs: number = Date.now()
): string {
  if (!value) return '—';
  const date = parseUtcTimestamp(value);
  if (!date) return value;

  const diffSeconds = Math.floor((nowMs - date.getTime()) / 1000);
  if (diffSeconds < 60) {
    return 'Just now';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  return formatExactLocalDateTime(value);
}

/**
 * React hook returning the current epoch ms, refreshing every intervalMs
 * so relative timestamps ("Just now" -> "1 minute ago") update without a page reload.
 */
export function useRelativeTimeTick(intervalMs: number = 30000): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return nowMs;
}

