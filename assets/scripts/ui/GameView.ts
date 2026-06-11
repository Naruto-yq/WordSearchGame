import { _decorator, Component, Label, Node } from 'cc';
import { EVENT } from '../core/GameConst';
import { EventCenter } from '../core/EventCenter';
import { CellPos, CheckResult, LevelClearResult } from '../core/GameTypes';
import { AudioManager } from '../manager/AudioManager';
import { GameManager } from '../manager/GameManager';
import { StorageManager } from '../manager/StorageManager';
import { UIManager } from '../manager/UIManager';
import { TouchController } from '../game/TouchController';

const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {
  @property(Label)
  levelLabel: Label | null = null;

  @property(Label)
  wordListLabel: Label | null = null;

  @property(Label)
  hintCountLabel: Label | null = null;

  @property(Node)
  boardRoot: Node | null = null;

  private touchController = new TouchController();
  private lockedPaths: CellPos[][] = [];

  onEnable(): void {
    EventCenter.on<CheckResult>(EVENT.WORD_FOUND, this.onWordFound);
    EventCenter.on<LevelClearResult>(EVENT.LEVEL_COMPLETED, this.onLevelCompleted);
    this.refresh();
  }

  onDisable(): void {
    EventCenter.off<CheckResult>(EVENT.WORD_FOUND, this.onWordFound);
    EventCenter.off<LevelClearResult>(EVENT.LEVEL_COMPLETED, this.onLevelCompleted);
  }

  refresh(): void {
    const runtime = GameManager.instance.getRuntime();
    if (!runtime) {
      return;
    }

    if (this.levelLabel) {
      this.levelLabel.string = `Level ${runtime.config.id}`;
    }
    if (this.wordListLabel) {
      const found = new Set(runtime.foundWords);
      this.wordListLabel.string = runtime.config.words
        .map((word) => (found.has(word) ? `${word} ✓` : word))
        .join('   ');
    }
    if (this.hintCountLabel) {
      this.hintCountLabel.string = String(StorageManager.load().hintCount);
    }
  }

  beginSelect(row: number, col: number): void {
    this.touchController.begin({ row, col });
  }

  moveSelect(row: number, col: number): void {
    this.touchController.move({ row, col });
  }

  endSelect(): void {
    const path = this.touchController.end();
    const clearResult = GameManager.instance.submitPath(path);
    if (clearResult) {
      UIManager.show('Result');
    }
    this.refresh();
  }

  async onHint(): Promise<void> {
    AudioManager.playSound('click');
    const hint = await GameManager.instance.useHint();
    if (hint.ok && hint.pos) {
      this.touchController.begin(hint.pos);
    }
    this.refresh();
  }

  onPause(): void {
    GameManager.instance.pauseGame();
  }

  onResume(): void {
    GameManager.instance.resumeGame();
  }

  onBack(): void {
    UIManager.show('Home');
  }

  private onWordFound = (result: CheckResult): void => {
    if (result.path) {
      this.lockedPaths.push(result.path);
    }
    this.refresh();
  };

  private onLevelCompleted = (_result: LevelClearResult): void => {
    this.refresh();
  };
}
