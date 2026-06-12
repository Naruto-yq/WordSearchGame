import { MAX_LEVEL } from '../core/GameConst';
import { createLevelConfig } from '../core/LevelGenerator';
import { LevelConfig } from '../core/GameTypes';
import { StorageManager } from './StorageManager';

export class LevelManager {
  private cache = new Map<number, LevelConfig>();

  async loadLevel(levelId: number): Promise<LevelConfig> {
    const normalizedId = Math.max(1, Math.min(MAX_LEVEL, Math.floor(levelId)));
    if (!this.cache.has(normalizedId)) {
      this.cache.set(normalizedId, createLevelConfig(normalizedId));
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
}
