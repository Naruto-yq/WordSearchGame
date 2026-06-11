import { StorageManager } from './StorageManager';

export class AudioManager {
  private static musicPlaying = false;

  static playMusic(_name = 'bgm'): void {
    if (!StorageManager.load().musicEnabled || this.musicPlaying) {
      return;
    }

    this.musicPlaying = true;
  }

  static stopMusic(): void {
    this.musicPlaying = false;
  }

  static playSound(_name: 'click' | 'correct' | 'wrong' | 'clear'): void {
    if (!StorageManager.load().soundEnabled) {
      return;
    }
  }
}
