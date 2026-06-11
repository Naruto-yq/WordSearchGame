import { _decorator, Button, Component, Node } from 'cc';
import { AudioManager } from '../manager/AudioManager';
import { GameManager } from '../manager/GameManager';
import { StorageManager } from '../manager/StorageManager';
import { UIManager } from '../manager/UIManager';

const { ccclass, property } = _decorator;

@ccclass('HomeView')
export class HomeView extends Component {
  @property(Button)
  startButton: Button | null = null;

  @property(Button)
  continueButton: Button | null = null;

  @property(Button)
  levelSelectButton: Button | null = null;

  @property(Button)
  settingButton: Button | null = null;

  @property(Node)
  settingPanel: Node | null = null;

  start(): void {
    AudioManager.playMusic();
    this.settingPanel && (this.settingPanel.active = false);
  }

  async onStartGame(): Promise<void> {
    AudioManager.playSound('click');
    await GameManager.instance.startLevel(StorageManager.load().maxUnlockedLevel);
    UIManager.show('Game');
  }

  async onContinueGame(): Promise<void> {
    AudioManager.playSound('click');
    await GameManager.instance.startLevel(StorageManager.load().currentLevel);
    UIManager.show('Game');
  }

  onOpenLevelSelect(): void {
    AudioManager.playSound('click');
    UIManager.show('LevelSelect');
  }

  onOpenSetting(): void {
    AudioManager.playSound('click');
    if (this.settingPanel) {
      this.settingPanel.active = true;
    }
  }
}
