import { CellPos } from '../core/GameTypes';

export class BoardCell {
  readonly pos: CellPos;
  readonly letter: string;
  selected = false;
  found = false;
  hinted = false;

  constructor(row: number, col: number, letter: string) {
    this.pos = { row, col };
    this.letter = letter;
  }

  setSelected(value: boolean): void {
    this.selected = value;
  }

  setFound(value: boolean): void {
    this.found = value;
  }

  setHinted(value: boolean): void {
    this.hinted = value;
  }
}
