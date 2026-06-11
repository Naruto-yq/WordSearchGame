import { _decorator, Button, Component, Label, Node } from 'cc';
import { MAX_LEVEL } from '../core/GameConst';
import { AudioManager } from '../manager/AudioManager';
import { GameManager } from '../manager/GameManager';
import { StorageManager } from '../manager/StorageManager';
import { UIManager } from '../manager/UIManager';

const { ccclass, property } = _decorator;

@ccclass('LevelSelectView')
export class LevelSelectView extends Component {
  @property(Node)
  levelRoot: Node | null = null;

  @property(Label)
  chapterLabel: Label | null = null;

  refresh(): void {
    const save = StorageManager.load();
    if (this.chapterLabel) {
      this.chapterLabel.string = 'Chapter 1';
    }

    this.levelRoot?.children.forEach((node, index) => {
      const levelId = index + 1;
      node.active = levelId <= MAX_LEVEL;
      const label = node.getComponent(Label);
      if (label) {
        const completed = save.completedLevels.includes(levelId);
        label.string = completed ? `${levelId} ✓` : String(levelId);
      }
    });
  }

  async onSelectLevel(button: Button, customEventData: string): Promise<void> {
    const levelId = Number(customEventData);
    if (!GameManager.instance.levelManager.isLevelUnlocked(levelId)) {
      return;
    }

    AudioManager.playSound('click');
    await GameManager.instance.startLevel(levelId);
    UIManager.show('Game');
  }

  onBack(): void {
    UIManager.show('Home');
  }
}
