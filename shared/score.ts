import type { Criterion } from './types';

/**
 * Score pondéré d'un projet sur 5.
 * Seuls les critères notés (1 à 5) entrent dans la moyenne.
 */
export function projectScore(
  scores: Record<string, number | null | undefined>,
  criteria: Pick<Criterion, 'id' | 'weight'>[],
): number | null {
  let sum = 0;
  let weights = 0;
  for (const c of criteria) {
    const s = scores[String(c.id)];
    if (typeof s === 'number' && s > 0 && c.weight > 0) {
      sum += s * c.weight;
      weights += c.weight;
    }
  }
  return weights > 0 ? Math.round((sum / weights) * 10) / 10 : null;
}
