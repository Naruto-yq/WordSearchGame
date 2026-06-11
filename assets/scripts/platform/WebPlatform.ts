import { IPlatform } from './IPlatform';

export class WebPlatform implements IPlatform {
  init(): void {}

  async showRewardVideo(): Promise<boolean> {
    return true;
  }

  async showInterstitial(): Promise<void> {}

  share(): void {}

  vibrateShort(): void {
    globalThis.navigator?.vibrate?.(20);
  }

  getStorage<T = unknown>(key: string): T | undefined {
    try {
      const value = globalThis.localStorage?.getItem(key);
      return value ? JSON.parse(value) as T : undefined;
    } catch {
      return undefined;
    }
  }

  setStorage<T = unknown>(key: string, value: T): void {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private or embedded runtimes.
    }
  }
}
