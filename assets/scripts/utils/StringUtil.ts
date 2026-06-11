export class StringUtil {
  static normalizeWord(word: string): string {
    return word.trim().toUpperCase().replace(/[^A-Z]/g, '');
  }

  static reverse(value: string): string {
    return value.split('').reverse().join('');
  }

  static padLevelId(levelId: number): string {
    return String(levelId).padStart(3, '0');
  }
}
