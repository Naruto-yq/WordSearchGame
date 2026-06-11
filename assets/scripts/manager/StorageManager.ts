import { DEFAULT_HINT_COUNT, SAVE_KEY } from '../core/GameConst';
import { SaveData } from '../core/GameTypes';
import { IPlatform } from '../platform/IPlatform';
import { WebPlatform } from '../platform/WebPlatform';

export class StorageManager {
  private static platform: IPlatform = new WebPlatform();
  private static data?: SaveData;

  static setup(platform: IPlatform): void {
    this.platform = platform;
    this.data = undefined;
  }

  static load(): SaveData {
    if (this.data) {
      return this.data;
    }

    const saved = this.platform.getStorage<Partial<SaveData>>(SAVE_KEY);
    this.data = this.mergeDefault(saved);
    this.save(this.data);
    return this.data;
  }

  static save(data: SaveData): void {
    this.data = data;
    this.platform.setStorage(SAVE_KEY, data);
  }

  static update(mutator: (data: SaveData) => void): SaveData {
    const data = { ...this.load(), completedLevels: [...this.load().completedLevels] };
    mutator(data);
    data.lastPlayTime = Date.now();
    this.save(data);
    return data;
  }

  static reset(): SaveData {
    const data = this.defaultData();
    this.save(data);
    return data;
  }

  static defaultData(): SaveData {
    return {
      currentLevel: 1,
      maxUnlockedLevel: 1,
      completedLevels: [],
      hintCount: DEFAULT_HINT_COUNT,
      coin: 0,
      musicEnabled: true,
      soundEnabled: true,
      vibrateEnabled: true,
      lastPlayTime: Date.now(),
    };
  }

  private static mergeDefault(value: Partial<SaveData> | undefined): SaveData {
    const defaults = this.defaultData();
    return {
      ...defaults,
      ...(value ?? {}),
      completedLevels: Array.isArray(value?.completedLevels) ? value.completedLevels : defaults.completedLevels,
    };
  }
}
