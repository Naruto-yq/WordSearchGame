export class RandomUtil {
  static int(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  static shuffle<T>(items: T[]): T[] {
    const cloned = [...items];
    for (let index = cloned.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(0, index);
      [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
    }
    return cloned;
  }
}
