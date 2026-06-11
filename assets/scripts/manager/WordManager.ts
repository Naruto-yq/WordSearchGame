import { BoardData, CellPos, CheckResult, LevelConfig } from '../core/GameTypes';
import { StringUtil } from '../utils/StringUtil';

export class WordManager {
  private targetWords: string[] = [];
  private foundWords = new Set<string>();
  private board?: BoardData;
  private allowReverse = true;

  setup(config: LevelConfig, board: BoardData, foundWords: string[] = []): void {
    this.targetWords = config.words.map(StringUtil.normalizeWord).filter(Boolean);
    this.allowReverse = config.allowReverse;
    this.board = board;
    this.foundWords = new Set(foundWords);
  }

  checkWord(path: CellPos[]): CheckResult {
    if (!this.board || path.length === 0) {
      return { matched: false };
    }

    const selected = path.map((pos) => this.board!.cells[pos.row]?.[pos.col] ?? '').join('');
    const forward = this.matchWord(selected);
    if (forward) {
      return this.markFound(forward, path, false);
    }

    if (this.allowReverse) {
      const reversed = this.matchWord(StringUtil.reverse(selected));
      if (reversed) {
        return this.markFound(reversed, [...path].reverse(), true);
      }
    }

    return { matched: false };
  }

  isAllWordsFound(): boolean {
    return this.targetWords.every((word) => this.foundWords.has(word));
  }

  getUnfoundWords(): string[] {
    return this.targetWords.filter((word) => !this.foundWords.has(word));
  }

  getFoundWords(): string[] {
    return [...this.foundWords];
  }

  private matchWord(value: string): string | undefined {
    return this.targetWords.find((word) => word === value && !this.foundWords.has(word));
  }

  private markFound(word: string, path: CellPos[], reversed: boolean): CheckResult {
    this.foundWords.add(word);
    return { matched: true, word, path, reversed };
  }
}
