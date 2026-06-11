export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert' | 'hell';

export interface LevelConfig {
  id: number;
  chapter: number;
  difficulty: Difficulty;
  boardSize: number;
  words: string[];
  allowReverse: boolean;
  allowDiagonal: boolean;
}

export interface CellPos {
  row: number;
  col: number;
}

export interface BoardCellData extends CellPos {
  letter: string;
  found: boolean;
  hinted: boolean;
}

export interface BoardData {
  size: number;
  cells: string[][];
  answers: Record<string, CellPos[]>;
}

export interface CheckResult {
  matched: boolean;
  word?: string;
  path?: CellPos[];
  reversed?: boolean;
}

export interface SaveData {
  currentLevel: number;
  maxUnlockedLevel: number;
  completedLevels: number[];
  hintCount: number;
  coin: number;
  musicEnabled: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  lastPlayTime: number;
}

export interface LevelRuntime {
  config: LevelConfig;
  board: BoardData;
  foundWords: string[];
  startedAt: number;
}

export interface LevelClearResult {
  levelId: number;
  usedSeconds: number;
  stars: number;
  coin: number;
  nextLevel: number;
}

export interface HintResult {
  ok: boolean;
  word?: string;
  pos?: CellPos;
  needAd?: boolean;
}

export enum Direction {
  Right = 'Right',
  Left = 'Left',
  Up = 'Up',
  Down = 'Down',
  RightDown = 'RightDown',
  LeftDown = 'LeftDown',
  RightUp = 'RightUp',
  LeftUp = 'LeftUp',
}

export interface DirectionVector {
  direction: Direction;
  rowDelta: number;
  colDelta: number;
}
