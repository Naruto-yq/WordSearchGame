export type ViewName = 'Launch' | 'Home' | 'LevelSelect' | 'Game' | 'Result';

export class UIManager {
  private static currentView: ViewName = 'Launch';

  static show(view: ViewName): void {
    this.currentView = view;
  }

  static getCurrentView(): ViewName {
    return this.currentView;
  }
}
