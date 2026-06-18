import { IPlatform, ShareOptions } from './IPlatform';

declare const wx: any;

export class WechatPlatform implements IPlatform {
  private wordAudio?: any;
  private slideAudioContext?: any;

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

  share(options?: ShareOptions): void {
    wx?.shareAppMessage?.(this.createShareInfo(options));
  }

  vibrateShort(): void {
    if (typeof wx === 'undefined') return;
    try {
      if (wx.vibrateLong) {
        wx.vibrateLong();
        return;
      }
      wx.vibrateShort?.({ type: 'heavy' });
      setTimeout(() => wx.vibrateShort?.({ type: 'medium' }), 85);
    } catch {
      // Vibration is optional feedback.
    }
  }

  speakWord(word: string): void {
    if (typeof wx === 'undefined' || !wx.createInnerAudioContext) return;

    try {
      this.wordAudio?.stop?.();
      this.wordAudio?.destroy?.();
      const audio = wx.createInnerAudioContext();
      audio.obeyMuteSwitch = false;
      audio.autoplay = true;
      audio.src = this.wordAudioUrl(word);
      const cleanup = () => {
        audio.offEnded?.(cleanup);
        audio.offError?.(cleanup);
        audio.destroy?.();
        if (this.wordAudio === audio) {
          this.wordAudio = undefined;
        }
      };
      audio.onEnded?.(cleanup);
      audio.onError?.(cleanup);
      audio.play?.();
      this.wordAudio = audio;
    } catch {
      // Online pronunciation is a best-effort feedback; gameplay should continue.
    }
  }

  playSlideTone(pitchIndex: number): boolean {
    const ctx = this.getSlideAudioContext();
    if (!ctx) return false;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.value = 520 + pitchIndex * 42;
      if (gain.gain.setValueAtTime) {
        gain.gain.setValueAtTime(0.075, now);
      } else {
        gain.gain.value = 0.075;
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
      return true;
    } catch {
      return false;
    }
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

  private createShareInfo(options?: ShareOptions): { title: string; query?: string; imageUrl?: string } {
    return {
      title: options?.title ?? '来挑战 Word Search 单词搜索',
      query: options?.query ?? 'from=share',
      imageUrl: options?.imageUrl ?? 'icon.png',
    };
  }

  private wordAudioUrl(word: string): string {
    return `https://fanyi.baidu.com/gettts?lan=en&spd=3&source=web&text=${encodeURIComponent(word.toLowerCase())}`;
  }

  private safeWechatCall(action: () => void): void {
    try {
      action();
    } catch {
      // Some WeChat DevTools SDK calls can fail before login/security info is ready.
    }
  }

  private getSlideAudioContext(): any | undefined {
    if (typeof wx === 'undefined') return undefined;
    if (this.slideAudioContext) {
      void this.slideAudioContext.resume?.();
      return this.slideAudioContext;
    }

    try {
      if (!wx.createWebAudioContext) return undefined;
      this.slideAudioContext = wx.createWebAudioContext();
      void this.slideAudioContext.resume?.();
      return this.slideAudioContext;
    } catch {
      return undefined;
    }
  }
}
