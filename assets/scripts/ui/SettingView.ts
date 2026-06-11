import { _decorator, Component, Toggle } from 'cc';
import { EVENT } from '../core/GameConst';
import { EventCenter } from '../core/EventCenter';
import { StorageManager } from '../manager/StorageManager';

const { ccclass, property } = _decorator;

@ccclass('SettingView')
export class SettingView extends Component {
  @property(Toggle)
  musicToggle: Toggle | null = null;

  @property(Toggle)
  soundToggle: Toggle | null = null;

  @property(Toggle)
  vibrateToggle: Toggle | null = null;

  onEnable(): void {
    const save = StorageManager.load();
    if (this.musicToggle) this.musicToggle.isChecked = save.musicEnabled;
    if (this.soundToggle) this.soundToggle.isChecked = save.soundEnabled;
    if (this.vibrateToggle) this.vibrateToggle.isChecked = save.vibrateEnabled;
  }

  onMusicChanged(toggle: Toggle): void {
    this.updateSetting('musicEnabled', toggle.isChecked);
  }

  onSoundChanged(toggle: Toggle): void {
    this.updateSetting('soundEnabled', toggle.isChecked);
  }

  onVibrateChanged(toggle: Toggle): void {
    this.updateSetting('vibrateEnabled', toggle.isChecked);
  }

  private updateSetting(key: 'musicEnabled' | 'soundEnabled' | 'vibrateEnabled', value: boolean): void {
    const save = StorageManager.update((data) => {
      data[key] = value;
    });
    EventCenter.emit(EVENT.SETTINGS_CHANGED, save);
  }
}
