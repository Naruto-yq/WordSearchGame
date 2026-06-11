import { IPlatform } from './IPlatform';

declare const wx: any;

export class WechatPlatform implements IPlatform {
  init(): void {
    if (typeof wx === 'undefined') return;
    this.safeWechatCall(() => wx.showShareMenu?.({ withShareTicket: false }));
    this.safeWechatCall(() => wx.onShareAppMessage?.(() => this.createShareInfo()));
    this.safeWechatCall(() => wx.onShareTimeline?.(() => this.createShareInfo()));
  }

  showRewardVideo(adUnitId?: string): Promise<boolean> {
    if (typeof wx === 'undefined' || !wx.createRewardedVideoAd || !adUnitId) {
      return Promise.resolve(false);
    }

    const ad = wx.createRewardedVideoAd({ adUnitId });
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
    if (typeof wx === 'undefined' || !wx.createInterstitialAd || !adUnitId) {
      return;
    }

    const ad = wx.createInterstitialAd({ adUnitId });
    await ad.show().catch(() => undefined);
  }

  share(): void {
    wx?.shareAppMessage?.(this.createShareInfo());
  }

  vibrateShort(): void {
    wx?.vibrateShort?.({ type: 'light' });
  }

  getStorage<T = unknown>(key: string): T | undefined {
    try {
      return wx?.getStorageSync?.(key);
    } catch {
      return undefined;
    }
  }

  setStorage<T = unknown>(key: string, value: T): void {
    try {
      wx?.setStorageSync?.(key, value);
    } catch {
      // Ignore platform storage failures; gameplay should continue.
    }
  }

  private createShareInfo(): { title: string; query?: string; imageUrl?: string } {
    return {
      title: '来挑战 Word Search 单词搜索',
      query: 'from=share',
    };
  }

  private safeWechatCall(action: () => void): void {
    try {
      action();
    } catch {
      // Some WeChat DevTools SDK calls can fail before login/security info is ready.
    }
  }
}
