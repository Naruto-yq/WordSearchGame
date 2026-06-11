import { MAX_LEVEL } from '../core/GameConst';
import { Difficulty, LevelConfig } from '../core/GameTypes';
import { StorageManager } from './StorageManager';

const WORD_BANK = [
  'CAT', 'DOG', 'SUN', 'MAP', 'SKY', 'KEY', 'BEE', 'CAR', 'BUS', 'CUP', 'HAT', 'BOX',
  'BIRD', 'FISH', 'TREE', 'MOON', 'STAR', 'RAIN', 'WIND', 'BOOK', 'GAME', 'WORD', 'HOME', 'CAKE',
  'APPLE', 'BEACH', 'LIGHT', 'SMILE', 'GREEN', 'CHAIR', 'TABLE', 'MUSIC', 'RIVER', 'STONE', 'GRASS',
  'PLANET', 'FOREST', 'PUZZLE', 'MARKET', 'GARDEN', 'ORANGE', 'POCKET', 'SUMMER', 'WINTER', 'SPRING',
  'FLOWER', 'BRIDGE', 'CASTLE', 'DRAGON', 'BUTTON', 'COFFEE', 'COOKIE', 'SILVER', 'YELLOW', 'PURPLE',
  'ANIMAL', 'FRIEND', 'ISLAND', 'JUNGLE', 'ROCKET', 'SCHOOL', 'TUNNEL', 'WINDOW', 'FAMILY', 'MONKEY',
  'ADVENTURE', 'BACKPACK', 'CALENDAR', 'DIAMOND', 'ELEPHANT', 'FESTIVAL', 'HOSPITAL', 'KEYBOARD',
  'LANGUAGE', 'MOUNTAIN', 'NOTEBOOK', 'PAINTING', 'QUESTION', 'RAINBOW', 'SANDWICH', 'TREASURE',
  'UMBRELLA', 'VACATION', 'WILDLIFE', 'SUNLIGHT', 'SEASHELL', 'BASEBALL', 'CAMPFIRE', 'AIRPLANE',
  'STARFISH', 'SNOWBALL', 'FIREFLY', 'DAYDREAM', 'LIFELONG', 'WATERMELON', 'BLACKBOARD',
  'TOOTHBRUSH', 'PLAYGROUND', 'BASKETBALL', 'SKATEBOARD', 'HELICOPTER', 'LIGHTHOUSE', 'FRIENDSHIP',
  'ADVENTURES', 'SKYSCRAPER', 'PHOTOGRAPH', 'WONDERLAND', 'DRAGONFRUIT', 'CELEBRATION', 'IMAGINATION',
];

export class LevelManager {
  private cache = new Map<number, LevelConfig>();

  async loadLevel(levelId: number): Promise<LevelConfig> {
    const normalizedId = Math.max(1, Math.min(MAX_LEVEL, Math.floor(levelId)));
    if (!this.cache.has(normalizedId)) {
      this.cache.set(normalizedId, this.createLevel(normalizedId));
    }
    return this.cache.get(normalizedId)!;
  }

  getCurrentLevel(): number {
    return StorageManager.load().currentLevel;
  }

  getNextLevel(levelId = this.getCurrentLevel()): number {
    return Math.min(levelId + 1, MAX_LEVEL);
  }

  isLevelUnlocked(levelId: number): boolean {
    return levelId <= StorageManager.load().maxUnlockedLevel;
  }

  private createLevel(id: number): LevelConfig {
    const boardSize = this.boardSizeFor(id);
    const minLength = this.minWordLengthFor(id);
    return {
      id,
      chapter: Math.ceil(id / 20),
      difficulty: this.difficultyFor(id),
      boardSize,
      words: this.takeWords(id, this.wordCountFor(id), minLength, this.maxWordLengthFor(id, boardSize, minLength)),
      allowReverse: true,
      allowDiagonal: true,
    };
  }

  private boardSizeFor(id: number): number {
    const rank = this.difficultyRankFor(id);
    if (rank < 5) return rank + 5;
    const phase = this.wavePhaseFor(id);
    return id >= 360 && (phase === 4 || phase === 10) ? 11 : 10;
  }

  private difficultyFor(id: number): Difficulty {
    const rank = this.difficultyRankFor(id);
    if (rank === 1) return 'easy';
    if (rank === 2) return 'normal';
    if (rank === 3) return 'hard';
    if (rank === 4) return 'expert';
    return 'hell';
  }

  private wordCountFor(id: number): number {
    const rank = this.difficultyRankFor(id);
    const progressBonus = Math.floor((id - 1) / 260);
    const peakBonus = this.isPeakLevel(id) ? 1 : 0;
    const baseByRank = [0, 4, 5, 6, 7, 8][rank] ?? 8;
    return this.clamp(baseByRank + Math.floor(progressBonus / 2) + peakBonus, 4, rank >= 5 ? 11 : 9);
  }

  private minWordLengthFor(id: number): number {
    const rank = this.difficultyRankFor(id);
    const progressBonus = Math.floor((id - 1) / 360);
    const baseByRank = [0, 3, 4, 4, 5, 6][rank] ?? 6;
    return this.clamp(baseByRank + progressBonus, 3, rank >= 5 ? 8 : 6);
  }

  private maxWordLengthFor(id: number, boardSize: number, minLength: number): number {
    const rank = this.difficultyRankFor(id);
    if (rank <= 2) return Math.min(boardSize, minLength + 2);
    if (rank === 3) return Math.min(boardSize, minLength + 3);
    return boardSize;
  }

  private wavePhaseFor(id: number): number {
    return (id - 1) % 12;
  }

  private difficultyRankFor(id: number): number {
    const wave = [1, 2, 3, 4, 5, 4, 2, 3, 4, 5, 5, 3];
    const progressBonus = Math.floor((id - 1) / 250);
    const base = wave[this.wavePhaseFor(id)];
    const bonusCap = base <= 2 ? 1 : base === 3 ? 2 : base === 4 ? 1 : 0;
    return this.clamp(base + Math.min(progressBonus, bonusCap), 1, 5);
  }

  private isPeakLevel(id: number): boolean {
    const phase = this.wavePhaseFor(id);
    return phase === 4 || phase === 10;
  }

  private takeWords(id: number, count: number, minLength: number, maxLength: number): string[] {
    const pool = WORD_BANK.filter((word) => word.length >= minLength && word.length <= maxLength);
    const words: string[] = [];
    let cursor = (id * 7) % pool.length;
    let guard = 0;

    while (words.length < count && guard < pool.length * 3) {
      const word = pool[cursor % pool.length];
      if (!words.includes(word)) {
        words.push(word);
      }
      cursor += 5;
      guard += 1;
    }

    return words;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
