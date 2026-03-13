/**
 * Korean 2-set (두벌식) keyboard → English key mapping.
 *
 * When a user types with Korean IME active, each Korean jamo maps to
 * a physical key that also produces an English letter. This function
 * converts Korean input back to the English letters on those same keys.
 *
 * Handles:
 * - Compatibility jamo (standalone ㄱ, ㅅ, ㅊ, etc.)
 * - Composed syllable blocks (가, 낫, etc.) — decomposed into jamo first
 * - Mixed input (ㅠㅅc → BTC)
 * - Non-Korean characters pass through unchanged
 */

// Initial consonants (초성) — 19 entries, indexed by syllable decomposition
const INITIALS = [
  'R', 'R', 'S', 'E', 'E', 'F', 'A', 'Q', 'Q', 'T',
  'T', 'D', 'W', 'W', 'C', 'Z', 'X', 'V', 'G',
];

// Medial vowels (중성) — 21 entries
const MEDIALS = [
  'K', 'O', 'I', 'O', 'J', 'P', 'U', 'P', 'H', 'HK',
  'HO', 'HL', 'Y', 'N', 'NJ', 'NP', 'NL', 'B', 'M', 'ML',
  'L',
];

// Final consonants (종성) — 28 entries (index 0 = no final)
const FINALS = [
  '', 'R', 'R', 'RT', 'S', 'SW', 'SG', 'E', 'F', 'FR',
  'FA', 'FQ', 'FT', 'FX', 'FV', 'FG', 'A', 'Q', 'QT', 'T',
  'T', 'D', 'W', 'C', 'Z', 'X', 'V', 'G',
];

// Compatibility jamo (U+3131–U+3163) → English key
const COMPAT_JAMO: Record<string, string> = {
  'ㄱ': 'R', 'ㄲ': 'R', 'ㄳ': 'RT', 'ㄴ': 'S', 'ㄵ': 'SW',
  'ㄶ': 'SG', 'ㄷ': 'E', 'ㄸ': 'E', 'ㄹ': 'F', 'ㄺ': 'FR',
  'ㄻ': 'FA', 'ㄼ': 'FQ', 'ㄽ': 'FT', 'ㄾ': 'FX', 'ㄿ': 'FV',
  'ㅀ': 'FG', 'ㅁ': 'A', 'ㅂ': 'Q', 'ㅃ': 'Q', 'ㅄ': 'QT',
  'ㅅ': 'T', 'ㅆ': 'T', 'ㅇ': 'D', 'ㅈ': 'W', 'ㅉ': 'W',
  'ㅊ': 'C', 'ㅋ': 'Z', 'ㅌ': 'X', 'ㅍ': 'V', 'ㅎ': 'G',
  'ㅏ': 'K', 'ㅐ': 'O', 'ㅑ': 'I', 'ㅒ': 'O', 'ㅓ': 'J',
  'ㅔ': 'P', 'ㅕ': 'U', 'ㅖ': 'P', 'ㅗ': 'H', 'ㅘ': 'HK',
  'ㅙ': 'HO', 'ㅚ': 'HL', 'ㅛ': 'Y', 'ㅜ': 'N', 'ㅝ': 'NJ',
  'ㅞ': 'NP', 'ㅟ': 'NL', 'ㅠ': 'B', 'ㅡ': 'M', 'ㅢ': 'ML',
  'ㅣ': 'L',
};

const SYLLABLE_BASE = 0xAC00;
const SYLLABLE_END = 0xD7A3;

export function koreanToEnglish(input: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const code = ch.charCodeAt(0);

    // Composed syllable block (가–힣)
    if (code >= SYLLABLE_BASE && code <= SYLLABLE_END) {
      const offset = code - SYLLABLE_BASE;
      const finalIdx = offset % 28;
      const medialIdx = ((offset - finalIdx) / 28) % 21;
      const initialIdx = Math.floor(offset / (21 * 28));
      result += INITIALS[initialIdx] + MEDIALS[medialIdx] + FINALS[finalIdx];
      continue;
    }

    // Compatibility jamo (ㄱ–ㅣ)
    const mapped = COMPAT_JAMO[ch];
    if (mapped) {
      result += mapped;
      continue;
    }

    // Non-Korean — pass through
    result += ch;
  }
  return result;
}

/** Returns true if the string contains any Korean characters */
export function hasKorean(input: string): boolean {
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(0);
    if ((code >= 0x3131 && code <= 0x3163) || (code >= SYLLABLE_BASE && code <= SYLLABLE_END)) {
      return true;
    }
  }
  return false;
}
