import { IPlatform } from './IPlatform';

declare const tt: any;

export class DouyinPlatform implements IPlatform {
  init(): void {
    tt?.showShareMenu?.();
  }

  showRewardVideo(adUnitId?: string): Promise<boolean> {
    if (typeof tt === 'undefined' || !tt.createRewardedVideoAd || !adUnitId) {
      return Promise.resolve(false);
    }

    const ad = tt.createRewardedVideoAd({ adUnitId });
    return new Promise((resolve) => {
      const cleanup = () => {
        ad.offClose?.(onClose);
        ad.offError?.(onError);
      };
      const onClose = (result: { isEnded?: boolean }) => {
        cleanup();
        resolve(Boolean(result?.isEnded));
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      ad.onClose(onClose);
      ad.onError(onError);
      ad.show().catch(() => ad.load().then(() => ad.show()).catch(onError));
    });
  }

  async showInterstitial(adUnitId?: string): Promise<void> {
    if (typeof tt === 'undefined' || !tt.createInterstitialAd || !adUnitId) {
      return;
    }

    const ad = tt.createInterstitialAd({ adUnitId });
    await ad.show().catch(() => undefined);
  }

  share(): void {
    tt?.shareAppMessage?.({ title: 'Word Search' });
  }

  vibrateShort(): void {
    tt?.vibrateShort?.();
  }

  getStorage<T = unknown>(key: string): T | undefined {
    try {
      return tt?.getStorageSync?.(key);
    } catch {
      return undefined;
    }
  }

  setStorage<T = unknown>(key: string, value: T): void {
    try {
      tt?.setStorageSync?.(key, value);
    } catch {
      // Ignore platform storage failures; gameplay should continue.
    }
  }
}
