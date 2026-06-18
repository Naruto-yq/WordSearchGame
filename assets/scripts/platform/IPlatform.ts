export interface ShareOptions {
  title?: string;
  query?: string;
  imageUrl?: string;
}

export interface IPlatform {
  init(): void;
  showRewardVideo(adUnitId?: string): Promise<boolean>;
  showInterstitial(adUnitId?: string): Promise<void>;
  share(options?: ShareOptions): void;
  vibrateShort(): void;
  speakWord(word: string): void;
  playSlideTone(pitchIndex: number): boolean;
  getStorage<T = unknown>(key: string): T | undefined;
  setStorage<T = unknown>(key: string, value: T): void;
}
