import { _decorator, Component, Label } from 'cc';
import { GameManager } from '../manager/GameManager';
import { UIManager } from '../manager/UIManager';

const { ccclass, property } = _decorator;

@ccclass('LaunchView')
export class LaunchView extends Component {
  @property(Label)
  loadingLabel: Label | null = null;

  start(): void {
    GameManager.instance.init();
    if (this.loadingLabel) {
      this.loadingLabel.string = 'Loading... 100%';
    }

    this.scheduleOnce(() => UIManager.show('Home'), 0.5);
  }
}
