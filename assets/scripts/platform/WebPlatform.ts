import { IPlatform, ShareOptions } from './IPlatform';

export class WebPlatform implements IPlatform {
  init(): void {}

  async showRewardVideo(): Promise<boolean> {
    return true;
  }

  async showInterstitial(): Promise<void> {}

  share(_options?: ShareOptions): void {}

  vibrateShort(): void {
    globalThis.navigator?.vibrate?.([55, 35, 55]);
  }

  speakWord(word: string): void {
    const speech = globalThis.speechSynthesis;
    const Utterance = globalThis.SpeechSynthesisUtterance;
    if (!speech || !Utterance) return;

    try {
      speech.cancel();
      const utterance = new Utterance(word.toLowerCase());
      utterance.lang = 'en-US';
      utterance.voice = this.pickFemaleEnglishVoice();
      utterance.rate = 0.82;
      utterance.pitch = 1.08;
      speech.speak(utterance);
    } catch {
      // Speech synthesis is optional in embedded browsers.
    }
  }

  playSlideTone(): boolean {
    return false;
  }

  private pickFemaleEnglishVoice(): SpeechSynthesisVoice | null {
    const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
    const englishVoices = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
    const preferredNames = [
      'Samantha',
      'Victoria',
      'Karen',
      'Moira',
      'Tessa',
      'Google US English',
      'Microsoft Aria',
      'Microsoft Jenny',
      'Female',
    ];

    for (const name of preferredNames) {
      const matched = englishVoices.find((voice) => voice.name.toLowerCase().includes(name.toLowerCase()));
      if (matched) return matched;
    }

    return englishVoices[0] ?? null;
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
