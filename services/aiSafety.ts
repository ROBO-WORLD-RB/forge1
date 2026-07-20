/**
 * Light fraud / spam heuristics for AI + user-generated text.
 * Rules-first only — not an ML fraud platform.
 */

export interface SpamCheckResult {
  flagged: boolean;
  reason?: string;
}

/**
 * Flag obvious spam / abuse patterns in free-text (signup bios, job posts, AI drafts).
 */
export function detectSpamText(text: string): SpamCheckResult {
  const t = (text || '').trim();
  if (!t) return { flagged: false };

  if (t.length > 8000) {
    return { flagged: true, reason: 'Text too long' };
  }

  if (/(.)\1{12,}/i.test(t)) {
    return { flagged: true, reason: 'Repeated character spam' };
  }

  const words = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 8) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    for (const [w, c] of counts) {
      if (w.length >= 3 && c >= 10 && c / words.length > 0.5) {
        return { flagged: true, reason: 'Repetitive spam pattern' };
      }
    }
  }

  if (
    /(whatsapp|telegram)\s*[:.]?\s*\+?\d{8,}/i.test(t) &&
    /(crypto|forex|investment|bitcoin|nigerian prince|send\s*money)/i.test(t)
  ) {
    return { flagged: true, reason: 'Suspicious promotional spam' };
  }

  const links = t.match(/(https?:\/\/|www\.)\S+/gi) || [];
  if (links.length >= 5) {
    return { flagged: true, reason: 'Too many links' };
  }

  return { flagged: false };
}

/** True when model output looks like a content-safety classifier stub. */
export function isSafetyClassifierStub(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (/^User Safety:\s*(safe|unsafe)\b/i.test(t)) return true;
  if (/^Response Safety:\s*(safe|unsafe)\b/i.test(t)) return true;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return (
    lines.length > 0 &&
    lines.length <= 3 &&
    lines.every((l) => /^(User|Response)\s+Safety:\s*(safe|unsafe)\b/i.test(l))
  );
}
