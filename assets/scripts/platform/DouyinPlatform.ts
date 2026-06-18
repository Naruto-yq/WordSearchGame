import { IPlatform, ShareOptions } from './IPlatform';

declare const tt: any;

export class DouyinPlatform implements IPlatform {
  private wordAudio?: any;
  private slideAudioContext?: any;

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

  share(options?: ShareOptions): void {
    tt?.shareAppMessage?.({ title: options?.title ?? 'Word Search' });
  }

  vibrateShort(): void {
    if (typeof tt === 'undefined') return;
    try {
      tt.vibrateLong?.();
    } catch {
      tt?.vibrateShort?.();
    }
  }

  speakWord(word: string): void {
    if (typeof tt === 'undefined' || !tt.createInnerAudioContext) return;

    try {
      this.wordAudio?.stop?.();
      this.wordAudio?.destroy?.();
      const audio = tt.createInnerAudioContext();
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
      // Online pronunciation is optional feedback.
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
      gain.gain.setValueAtTime?.(0.075, now);
      if (!gain.gain.setValueAtTime) gain.gain.value = 0.075;
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

  private wordAudioUrl(word: string): string {
    return `https://fanyi.baidu.com/gettts?lan=en&spd=3&source=web&text=${encodeURIComponent(word.toLowerCase())}`;
  }

  private getSlideAudioContext(): any | undefined {
    if (typeof tt === 'undefined') return undefined;
    if (this.slideAudioContext) {
      void this.slideAudioContext.resume?.();
      return this.slideAudioContext;
    }

    try {
      if (!tt.createWebAudioContext) return undefined;
      this.slideAudioContext = tt.createWebAudioContext();
      void this.slideAudioContext.resume?.();
      return this.slideAudioContext;
    } catch {
      return undefined;
    }
  }
}
