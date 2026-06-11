import { CellPos } from '../core/GameTypes';

export class TouchController {
  private path: CellPos[] = [];
  private direction?: CellPos;

  begin(pos: CellPos): CellPos[] {
    this.path = [pos];
    this.direction = undefined;
    return this.path;
  }

  move(pos: CellPos): CellPos[] {
    if (this.path.length === 0 || this.hasCell(pos)) {
      return this.path;
    }

    const start = this.path[0];
    const rowDelta = pos.row - start.row;
    const colDelta = pos.col - start.col;
    const normalized = this.normalizeDirection(rowDelta, colDelta);
    if (!normalized) {
      return this.path;
    }

    if (!this.direction) {
      this.direction = normalized;
    }

    if (this.direction.row !== normalized.row || this.direction.col !== normalized.col) {
      return this.path;
    }

    this.path = this.buildStraightPath(start, pos, this.direction);
    return this.path;
  }

  end(): CellPos[] {
    const result = this.path;
    this.path = [];
    this.direction = undefined;
    return result;
  }

  getPath(): CellPos[] {
    return this.path;
  }

  private hasCell(pos: CellPos): boolean {
    return this.path.some((cell) => cell.row === pos.row && cell.col === pos.col);
  }

  private normalizeDirection(rowDelta: number, colDelta: number): CellPos | undefined {
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);

    if (rowStep === 0 && colStep === 0) {
      return undefined;
    }

    const rowDistance = Math.abs(rowDelta);
    const colDistance = Math.abs(colDelta);
    const isStraight = rowDistance === 0 || colDistance === 0;
    const isDiagonal = rowDistance === colDistance;

    if (!isStraight && !isDiagonal) {
      return undefined;
    }

    return { row: rowStep, col: colStep };
  }

  private buildStraightPath(start: CellPos, end: CellPos, step: CellPos): CellPos[] {
    const length = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col));
    return Array.from({ length: length + 1 }, (_, index) => ({
      row: start.row + step.row * index,
      col: start.col + step.col * index,
    }));
  }
}
