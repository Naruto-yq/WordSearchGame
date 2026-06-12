import { MAX_LEVEL } from './GameConst';
import { Difficulty, LevelConfig } from './GameTypes';
import { WORD_BANK } from './WordBank';

export interface GeneratedLevelSpec {
  id: number;
  chapter: number;
  difficulty: Difficulty;
  difficultyLabel: string;
  boardSize: number;
  words: string[];
  allowReverse: boolean;
  allowDiagonal: boolean;
}

export interface LevelRepeatStats {
  levels: number;
  totalWords: number;
  uniqueWords: number;
  repeatedWords: number;
  repeatRate: number;
}

const ROLLER_COASTER_WAVE = [1, 2, 3, 4, 5, 4, 2, 3, 4, 5, 5, 3];
const FIRST_LEVEL_WORDS = ['CAT', 'DOG', 'SUN', 'CAR'];
const NORMALIZED_WORD_BANK = Array.from(new Set(
  WORD_BANK
    .map((word) => String(word).trim().toUpperCase())
    .filter((word) => /^[A-Z]+$/.test(word) && word.length >= 3 && word.length <= 11),
));

let levelWordsCache: string[][] | undefined;
const rangePoolCache = new Map<string, string[]>();

export function createLevelConfig(levelId: number): LevelConfig {
  const id = normalizeLevelId(levelId);
  return {
    id,
    chapter: Math.ceil(id / 20),
    difficulty: difficultyFor(id),
    boardSize: boardSizeFor(id),
    words: getLevelWords(id),
    allowReverse: true,
    allowDiagonal: true,
  };
}

export function createLevelSpec(levelId: number): GeneratedLevelSpec {
  const config = createLevelConfig(levelId);
  return {
    ...config,
    difficultyLabel: difficultyLabelFor(config.id),
  };
}

export function getLevelWords(levelId: number): string[] {
  const id = normalizeLevelId(levelId);
  return [...getAllLevelWords()[id - 1]];
}

export function getLevelRepeatStats(): LevelRepeatStats {
  const words = getAllLevelWords().flat();
  const uniqueWords = new Set(words).size;
  const repeatedWords = words.length - uniqueWords;
  return {
    levels: MAX_LEVEL,
    totalWords: words.length,
    uniqueWords,
    repeatedWords,
    repeatRate: words.length === 0 ? 0 : repeatedWords / words.length,
  };
}

export function boardSizeFor(levelId: number): number {
  const level = normalizeLevelId(levelId);
  const rank = difficultyRankFor(level);
  if (rank < 5) return rank + 5;
  const phase = wavePhaseFor(level);
  return level >= 360 && (phase === 4 || phase === 10) ? 11 : 10;
}

export function difficultyRankFor(levelId: number): number {
  const level = normalizeLevelId(levelId);
  const base = ROLLER_COASTER_WAVE[wavePhaseFor(level)];
  const progressBonus = Math.floor((level - 1) / 250);
  const bonusCap = base <= 2 ? 1 : base === 3 ? 2 : base === 4 ? 1 : 0;
  return clamp(base + Math.min(progressBonus, bonusCap), 1, 5);
}

function getAllLevelWords(): string[][] {
  if (!levelWordsCache) {
    levelWordsCache = buildLevelWords();
  }
  return levelWordsCache;
}

function buildLevelWords(): string[][] {
  const usedWords = new Set<string>();
  const rangeCursors = new Map<string, number>();
  const levels: string[][] = [];

  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const boardSize = boardSizeFor(level);
    const minLength = minWordLengthFor(level);
    const maxLength = maxWordLengthFor(level, boardSize, minLength);
    const count = wordCountFor(level);
    const localWords = new Set<string>();
    const words: string[] = [];

    if (level === 1) {
      for (const word of FIRST_LEVEL_WORDS) {
        if (words.length >= count) break;
        if (canUseWord(word, minLength, maxLength, localWords)) {
          addLevelWord(words, usedWords, localWords, word);
        }
      }
    }

    while (words.length < count) {
      const word = pickWord(level, words.length, minLength, maxLength, usedWords, localWords, rangeCursors);
      if (!word) {
        throw new Error(`Unable to pick enough words for level ${level}`);
      }
      addLevelWord(words, usedWords, localWords, word);
    }

    levels.push(words);
  }

  return levels;
}

function addLevelWord(words: string[], usedWords: Set<string>, localWords: Set<string>, word: string): void {
  words.push(word);
  usedWords.add(word);
  localWords.add(word);
}

function canUseWord(word: string, minLength: number, maxLength: number, localWords: Set<string>): boolean {
  return word.length >= minLength && word.length <= maxLength && !localWords.has(word);
}

function pickWord(
  level: number,
  slot: number,
  minLength: number,
  maxLength: number,
  usedWords: Set<string>,
  localWords: Set<string>,
  rangeCursors: Map<string, number>,
): string | undefined {
  const key = rangeKey(minLength, maxLength);
  const pool = getRangePool(minLength, maxLength);
  if (pool.length === 0) return undefined;

  const startCursor = rangeCursors.get(key) ?? ((hashString(`${key}:${level}:${slot}`) % pool.length) >>> 0);
  const unusedWord = scanPool(pool, startCursor, localWords, usedWords, false);
  if (unusedWord) {
    rangeCursors.set(key, (unusedWord.index + 1) % pool.length);
    return unusedWord.word;
  }

  const reusableWord = scanPool(pool, startCursor, localWords, usedWords, true);
  if (reusableWord) {
    rangeCursors.set(key, (reusableWord.index + 1) % pool.length);
    return reusableWord.word;
  }

  return undefined;
}

function scanPool(
  pool: string[],
  startCursor: number,
  localWords: Set<string>,
  usedWords: Set<string>,
  allowPreviouslyUsed: boolean,
): { word: string; index: number } | undefined {
  for (let offset = 0; offset < pool.length; offset += 1) {
    const index = (startCursor + offset) % pool.length;
    const word = pool[index];
    if (localWords.has(word)) continue;
    if (!allowPreviouslyUsed && usedWords.has(word)) continue;
    return { word, index };
  }
  return undefined;
}

function getRangePool(minLength: number, maxLength: number): string[] {
  const key = rangeKey(minLength, maxLength);
  const cached = rangePoolCache.get(key);
  if (cached) return cached;

  const pool = NORMALIZED_WORD_BANK
    .filter((word) => word.length >= minLength && word.length <= maxLength)
    .sort((left, right) => {
      const score = hashString(`${key}:${left}`) - hashString(`${key}:${right}`);
      return score === 0 ? left.localeCompare(right) : score;
    });

  rangePoolCache.set(key, pool);
  return pool;
}

function difficultyFor(levelId: number): Difficulty {
  const rank = difficultyRankFor(levelId);
  if (rank === 1) return 'easy';
  if (rank === 2) return 'normal';
  if (rank === 3) return 'hard';
  if (rank === 4) return 'expert';
  return 'hell';
}

function difficultyLabelFor(levelId: number): string {
  const rank = difficultyRankFor(levelId);
  if (rank === 1) return '简单';
  if (rank === 2) return '中等';
  if (rank === 3) return '难';
  if (rank === 4) return '困难';
  return boardSizeFor(levelId) >= 11 ? '地狱' : '噩梦';
}

function wordCountFor(levelId: number): number {
  const rank = difficultyRankFor(levelId);
  const progressBonus = Math.floor((levelId - 1) / 260);
  const peakBonus = isPeakLevel(levelId) ? 1 : 0;
  const baseByRank = [0, 4, 5, 6, 7, 8][rank] ?? 8;
  return clamp(baseByRank + Math.floor(progressBonus / 2) + peakBonus, 4, rank >= 5 ? 11 : 9);
}

function minWordLengthFor(levelId: number): number {
  const rank = difficultyRankFor(levelId);
  const progressBonus = Math.floor((levelId - 1) / 360);
  const baseByRank = [0, 3, 4, 4, 5, 6][rank] ?? 6;
  return clamp(baseByRank + progressBonus, 3, rank >= 5 ? 8 : 6);
}

function maxWordLengthFor(levelId: number, boardSize: number, minLength: number): number {
  const rank = difficultyRankFor(levelId);
  if (rank <= 2) return Math.min(boardSize, minLength + 2);
  if (rank === 3) return Math.min(boardSize, minLength + 3);
  return boardSize;
}

function isPeakLevel(levelId: number): boolean {
  const phase = wavePhaseFor(levelId);
  return phase === 4 || phase === 10;
}

function wavePhaseFor(levelId: number): number {
  return (normalizeLevelId(levelId) - 1) % ROLLER_COASTER_WAVE.length;
}

function normalizeLevelId(levelId: number): number {
  return clamp(Math.floor(Number.isFinite(levelId) ? levelId : 1), 1, MAX_LEVEL);
}

function rangeKey(minLength: number, maxLength: number): string {
  return `${minLength}-${maxLength}`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
