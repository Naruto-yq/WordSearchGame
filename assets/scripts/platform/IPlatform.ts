export interface IPlatform {
  init(): void;
  showRewardVideo(adUnitId?: string): Promise<boolean>;
  showInterstitial(adUnitId?: string): Promise<void>;
  share(): void;
  vibrateShort(): void;
  getStorage<T = unknown>(key: string): T | undefined;
  setStorage<T = unknown>(key: string, value: T): void;
}
