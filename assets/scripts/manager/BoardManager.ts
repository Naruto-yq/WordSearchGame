import { LETTERS } from '../core/GameConst';
import { BoardData, CellPos, Direction, DirectionVector, LevelConfig } from '../core/GameTypes';
import { ArrayUtil } from '../utils/ArrayUtil';
import { RandomUtil } from '../utils/RandomUtil';
import { StringUtil } from '../utils/StringUtil';

const ALL_DIRECTIONS: DirectionVector[] = [
  { direction: Direction.Right, rowDelta: 0, colDelta: 1 },
  { direction: Direction.Left, rowDelta: 0, colDelta: -1 },
  { direction: Direction.Down, rowDelta: 1, colDelta: 0 },
  { direction: Direction.Up, rowDelta: -1, colDelta: 0 },
  { direction: Direction.RightDown, rowDelta: 1, colDelta: 1 },
  { direction: Direction.LeftDown, rowDelta: 1, colDelta: -1 },
  { direction: Direction.RightUp, rowDelta: -1, colDelta: 1 },
  { direction: Direction.LeftUp, rowDelta: -1, colDelta: -1 },
];

interface WordPlacementResult {
  diagonal: boolean;
}

export class BoardManager {
  private board?: BoardData;

  generateBoard(config: LevelConfig): BoardData {
    const words = config.words
      .map(StringUtil.normalizeWord)
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    for (let rebuild = 0; rebuild < 60; rebuild += 1) {
      const cells = ArrayUtil.createMatrix<string>(config.boardSize, () => '');
      const answers: Record<string, CellPos[]> = {};
      const diagonalTarget = this.getDiagonalTarget(config, words.length);
      let diagonalPlaced = 0;
      let placed = true;
      const enforceDiagonal = rebuild < 14;

      for (const word of words) {
        const result = this.tryPlaceWord(cells, word, config, answers, enforceDiagonal && diagonalPlaced < diagonalTarget);
        if (!result) {
          placed = false;
          break;
        }
        if (result.diagonal) {
          diagonalPlaced += 1;
        }
      }

      if (placed) {
        this.fillEmptyCells(cells);
        this.board = { size: config.boardSize, cells, answers };
        return this.board;
      }
    }

    throw new Error(`Unable to generate board for level ${config.id}`);
  }

  clearBoard(): void {
    this.board = undefined;
  }

  getCell(row: number, col: number): string | undefined {
    return this.board?.cells[row]?.[col];
  }

  getBoard(): BoardData | undefined {
    return this.board;
  }

  static getAllowedDirections(config: Pick<LevelConfig, 'allowReverse' | 'allowDiagonal'>): DirectionVector[] {
    return ALL_DIRECTIONS.filter((vector) => {
      const isReverse = vector.direction === Direction.Left || vector.direction === Direction.Up ||
        vector.direction === Direction.LeftUp || vector.direction === Direction.RightUp ||
        vector.direction === Direction.LeftDown;
      const isDiagonal = vector.rowDelta !== 0 && vector.colDelta !== 0;

      return (config.allowReverse || !isReverse) && (config.allowDiagonal || !isDiagonal);
    });
  }

  private tryPlaceWord(
    cells: string[][],
    word: string,
    config: LevelConfig,
    answers: Record<string, CellPos[]>,
    preferDiagonal: boolean,
  ): WordPlacementResult | undefined {
    const directions = BoardManager.getAllowedDirections(config);

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const direction = this.pickDirection(directions, preferDiagonal);
      const start = {
        row: RandomUtil.int(0, config.boardSize - 1),
        col: RandomUtil.int(0, config.boardSize - 1),
      };

      const path = this.buildPath(start, direction, word.length, config.boardSize);
      if (path && this.canPlace(cells, path, word)) {
        path.forEach((pos, index) => {
          cells[pos.row][pos.col] = word[index];
        });
        answers[word] = path;
        return { diagonal: this.isDiagonal(direction) };
      }
    }

    return undefined;
  }

  private getDiagonalTarget(config: LevelConfig, wordCount: number): number {
    if (!config.allowDiagonal || wordCount === 0) return 0;
    const ratio = config.difficulty === 'easy'
      ? 0.1
      : config.difficulty === 'normal'
        ? 0.12
        : config.difficulty === 'hard'
          ? 0.16
          : config.difficulty === 'expert'
            ? 0.22
            : 0.26;
    return Math.max(1, Math.min(wordCount, Math.round(wordCount * ratio)));
  }

  private pickDirection(directions: DirectionVector[], preferDiagonal: boolean): DirectionVector {
    const diagonalDirections = directions.filter((direction) => this.isDiagonal(direction));
    const pool = preferDiagonal && diagonalDirections.length > 0 ? diagonalDirections : directions;
    const totalWeight = pool.reduce((sum, direction) => sum + this.directionWeight(direction, preferDiagonal), 0);
    let cursor = Math.random() * totalWeight;

    for (const direction of pool) {
      cursor -= this.directionWeight(direction, preferDiagonal);
      if (cursor <= 0) {
        return direction;
      }
    }

    return pool[pool.length - 1];
  }

  private directionWeight(direction: DirectionVector, preferDiagonal: boolean): number {
    if (this.isDiagonal(direction)) return preferDiagonal ? 2 : 1;
    return preferDiagonal ? 1 : 4;
  }

  private isDiagonal(direction: DirectionVector): boolean {
    return direction.rowDelta !== 0 && direction.colDelta !== 0;
  }

  private buildPath(start: CellPos, direction: DirectionVector, length: number, size: number): CellPos[] | undefined {
    const path: CellPos[] = [];
    for (let index = 0; index < length; index += 1) {
      const row = start.row + direction.rowDelta * index;
      const col = start.col + direction.colDelta * index;

      if (row < 0 || row >= size || col < 0 || col >= size) {
        return undefined;
      }

      path.push({ row, col });
    }
    return path;
  }

  private canPlace(cells: string[][], path: CellPos[], word: string): boolean {
    return path.every((pos, index) => {
      const current = cells[pos.row][pos.col];
      return current === '' || current === word[index];
    });
  }

  private fillEmptyCells(cells: string[][]): void {
    for (let row = 0; row < cells.length; row += 1) {
      for (let col = 0; col < cells[row].length; col += 1) {
        if (cells[row][col] === '') {
          cells[row][col] = LETTERS[RandomUtil.int(0, LETTERS.length - 1)];
        }
      }
    }
  }
}
