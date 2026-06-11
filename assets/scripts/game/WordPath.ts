import { CellPos } from '../core/GameTypes';

export class WordPath {
  constructor(
    readonly word: string,
    readonly path: CellPos[],
  ) {}
}
