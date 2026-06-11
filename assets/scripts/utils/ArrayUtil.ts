export class ArrayUtil {
  static createMatrix<T>(size: number, factory: (row: number, col: number) => T): T[][] {
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => factory(row, col)),
    );
  }
}
