import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Layers,
  Node,
  UITransform,
  Vec3,
} from 'cc';
import { CellPos, LevelClearResult } from '../core/GameTypes';
import { GameManager } from '../manager/GameManager';
import { StorageManager } from '../manager/StorageManager';

const { ccclass } = _decorator;

const WIDTH = 750;
const CELL_GAP = 8;
const BOARD_TOP = 250;
const WORD_COLORS = [
  [44, 130, 110],
  [220, 95, 82],
  [73, 117, 198],
  [192, 126, 57],
  [136, 94, 170],
  [45, 145, 160],
  [207, 92, 140],
  [92, 132, 63],
];
const SELECT_FALLBACK = [252, 206, 95];

interface CellView {
  graphics: Graphics;
  label: Label;
  pos: CellPos;
  size: number;
}

@ccclass('WordSearchRuntime')
export class WordSearchRuntime extends Component {
  private selectedPath: CellPos[] = [];
  private isDragging = false;
  private statusLabel?: Label;
  private wordLabel?: Label;
  private hintLabel?: Label;
  private boardRoot?: Node;
  private nextButton?: Node;
  private found = new Set<string>();
  private cellViews = new Map<string, CellView>();
  private boardMetrics = { startX: 0, startY: 0, cellSize: 0, gap: 0 };

  async start(): Promise<void> {
    this.clearGameNodes();
    this.drawBackground();
    this.createLabel('Loading Word Search...', 0, 40, 36, new Color(32, 48, 64, 255));

    try {
      GameManager.instance.init();
      await GameManager.instance.startLevel(StorageManager.load().currentLevel);
      this.render();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.clearGameNodes();
      this.drawBackground();
      this.createLabel('Word Search 启动失败', 0, 80, 34, new Color(160, 48, 48, 255));
      this.createLabel(message, 0, 20, 20, new Color(80, 80, 80, 255));
      console.error('[WordSearchRuntime] start failed:', error);
    }
  }

  private render(): void {
    this.clearGameNodes();
    this.found.clear();

    this.drawBackground();
    this.createLabel('Word Search', 0, 560, 56, new Color(32, 48, 64, 255));
    this.statusLabel = this.createLabel('按住字母滑动连线，松手完成选择', 0, 490, 28, new Color(69, 90, 100, 255));
    this.wordLabel = this.createLabel('', 0, 430, 30, new Color(24, 67, 95, 255));
    this.hintLabel = this.createLabel('', 0, -505, 24, new Color(84, 95, 110, 255));

    this.createButton('提示', -165, -575, 160, 64, () => this.onHint());
    this.createButton('重开', 0, -575, 160, 64, () => this.onRestart());
    this.nextButton = this.createButton('下一关', 165, -575, 160, 64, () => this.onNext());
    this.nextButton.active = false;

    this.boardRoot = new Node('BoardRoot');
    this.boardRoot.layer = Layers.Enum.UI_2D;
    this.node.addChild(this.boardRoot);
    this.renderBoard();
    this.refreshHeader();
  }

  private clearGameNodes(): void {
    [...this.node.children].forEach((child) => {
      if (child.name !== 'UICamera_Canvas') {
        child.parent = null;
      }
    });
  }

  private drawBackground(): void {
    const background = new Node('Background');
    background.layer = Layers.Enum.UI_2D;
    this.node.addChild(background);
    background.addComponent(UITransform).setContentSize(WIDTH, 1334);
    const graphics = background.addComponent(Graphics);
    graphics.fillColor = new Color(239, 246, 241, 255);
    graphics.rect(-WIDTH / 2, -667, WIDTH, 1334);
    graphics.fill();
  }

  private renderBoard(): void {
    const runtime = GameManager.instance.getRuntime();
    if (!runtime || !this.boardRoot) {
      return;
    }

    this.boardRoot.removeAllChildren();
    this.cellViews.clear();
    const size = runtime.board.size;
    const boardWidth = Math.min(650, WIDTH - 80);
    const cellSize = Math.floor((boardWidth - CELL_GAP * (size - 1)) / size);
    const actualBoardWidth = cellSize * size + CELL_GAP * (size - 1);
    const startX = -actualBoardWidth / 2 + cellSize / 2;
    const startY = BOARD_TOP - cellSize / 2;
    this.boardMetrics = { startX, startY, cellSize, gap: CELL_GAP };
    const boardTransform = this.boardRoot.getComponent(UITransform) ?? this.boardRoot.addComponent(UITransform);
    boardTransform.setContentSize(actualBoardWidth, actualBoardWidth);

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const cell = this.createCell(runtime.board.cells[row][col], cellSize, row, col);
        cell.setPosition(startX + col * (cellSize + CELL_GAP), startY - row * (cellSize + CELL_GAP));
        this.boardRoot.addChild(cell);
      }
    }
    this.refreshCellStyles();
  }

  private createCell(letter: string, size: number, row: number, col: number): Node {
    const runtime = GameManager.instance.getRuntime();
    const pos = { row, col };
    const key = this.cellKey(pos);
    const foundCells = new Set<string>();
    runtime?.foundWords.forEach((word) => runtime.board.answers[word]?.forEach((cell) => foundCells.add(this.cellKey(cell))));
    const isFound = foundCells.has(key);

    const cell = new Node(`Cell_${row}_${col}`);
    cell.layer = Layers.Enum.UI_2D;
    cell.addComponent(UITransform).setContentSize(size, size);

    const graphics = cell.addComponent(Graphics);
    const label = this.createLabel(letter, 0, -2, Math.max(22, Math.floor(size * 0.42)), isFound ? Color.WHITE : new Color(32, 45, 53, 255), cell);
    this.cellViews.set(key, { graphics, label, pos, size });
    cell.on('touch-start', () => this.beginDrag(pos), this);
    cell.on('touch-move', (event: { getUILocation?: () => { x: number; y: number } }) => this.moveDrag(event), this);
    cell.on('touch-end', (event: { getUILocation?: () => { x: number; y: number } }) => this.endDrag(event), this);
    cell.on('touch-cancel', (event: { getUILocation?: () => { x: number; y: number } }) => this.endDrag(event), this);
    return cell;
  }

  private createLabel(text: string, x: number, y: number, fontSize: number, color: Color, parent = this.node): Label {
    const node = new Node(`Label_${text}`);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(WIDTH - 80, fontSize + 18);

    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.horizontalAlign = 1;
    label.verticalAlign = 1;
    label.color = color;
    return label;
  }

  private createButton(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    handler: () => void | Promise<void>,
  ): Node {
    const button = new Node(`Button_${text}`);
    button.layer = Layers.Enum.UI_2D;
    button.setPosition(x, y);
    this.node.addChild(button);
    button.addComponent(UITransform).setContentSize(width, height);

    const graphics = button.addComponent(Graphics);
    graphics.fillColor = new Color(44, 130, 110, 255);
    graphics.roundRect(-width / 2, -height / 2, width, height, 16);
    graphics.fill();
    this.createLabel(text, 0, 0, 26, Color.WHITE, button);
    button.on('touch-end', handler, this);
    return button;
  }

  private beginDrag(pos: CellPos): void {
    this.isDragging = true;
    this.selectedPath = [pos];
    this.setStatus('滑动到单词末尾后松手');
    this.refreshCellStyles();
  }

  private moveDrag(event: { getUILocation?: () => { x: number; y: number } }): void {
    if (!this.isDragging) {
      return;
    }

    const pos = this.cellFromTouch(event);
    const start = this.selectedPath[0];
    if (!pos || !start) {
      return;
    }

    const path = this.buildPath(start, pos);
    if (path.length > 0 && this.pathKey(path) !== this.pathKey(this.selectedPath)) {
      this.selectedPath = path;
      this.refreshCellStyles();
    }
  }

  private endDrag(event: { getUILocation?: () => { x: number; y: number } }): void {
    if (!this.isDragging) {
      return;
    }

    this.moveDrag(event);
    this.isDragging = false;
    const path = this.selectedPath;
    this.selectedPath = [];
    this.submitSelection(path);
    this.refreshCellStyles();
  }

  private submitSelection(path: CellPos[]): void {
    if (path.length < 2) {
      this.setStatus('请按住并滑过完整单词');
      return;
    }

    const beforeCount = GameManager.instance.getRuntime()?.foundWords.length ?? 0;
    const clearResult = GameManager.instance.submitPath(path);
    const runtime = GameManager.instance.getRuntime();
    runtime?.foundWords.forEach((word) => this.found.add(word));
    this.refreshHeader();

    if (clearResult) {
      this.showClear(clearResult);
      if (this.nextButton) this.nextButton.active = true;
    } else if ((runtime?.foundWords.length ?? 0) > beforeCount) {
      this.setStatus('找到一个单词，继续滑动寻找下一个');
    } else {
      this.setStatus('未找到单词，请重新滑动');
    }
  }

  private buildPath(start: CellPos, end: CellPos): CellPos[] {
    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);
    const isStraight = rowDelta === 0 || colDelta === 0;
    const isDiagonal = Math.abs(rowDelta) === Math.abs(colDelta);
    if (!isStraight && !isDiagonal) {
      return [];
    }

    const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
    return Array.from({ length: length + 1 }, (_, index) => ({
      row: start.row + rowStep * index,
      col: start.col + colStep * index,
    }));
  }

  private async onHint(): Promise<void> {
    const hint = await GameManager.instance.useHint();
    if (hint.ok && hint.word && hint.pos) {
      this.setStatus(`提示：${hint.word} 从第 ${hint.pos.row + 1} 行第 ${hint.pos.col + 1} 列开始`);
    } else {
      this.setStatus('提示暂不可用');
    }
    this.refreshHeader();
  }

  private async onRestart(): Promise<void> {
    this.selectedPath = [];
    this.isDragging = false;
    await GameManager.instance.restartLevel();
    this.render();
  }

  private async onNext(): Promise<void> {
    const levelId = StorageManager.load().currentLevel;
    await GameManager.instance.startLevel(levelId);
    this.render();
    this.setStatus('按住字母滑动连线，松手完成选择');
  }

  private refreshHeader(): void {
    const runtime = GameManager.instance.getRuntime();
    if (!runtime) {
      return;
    }

    this.setStatus(`Level ${runtime.config.id}  ${runtime.config.difficulty.toUpperCase()}`);
    if (this.wordLabel) {
      const found = new Set(runtime.foundWords);
      this.wordLabel.string = runtime.config.words.map((word) => (found.has(word) ? `${word} ✓` : word)).join('   ');
    }
    if (this.hintLabel) {
      this.hintLabel.string = `提示次数：${StorageManager.load().hintCount}    金币：${StorageManager.load().coin}`;
    }
  }

  private showClear(result: LevelClearResult): void {
    const minute = Math.floor(result.usedSeconds / 60).toString().padStart(2, '0');
    const second = (result.usedSeconds % 60).toString().padStart(2, '0');
    this.setStatus(`通关！${'★'.repeat(result.stars)}  用时 ${minute}:${second}  金币 +${result.coin}，点击下一关`);
    if (this.nextButton) this.nextButton.active = true;
  }

  private setStatus(text: string): void {
    if (this.statusLabel) {
      this.statusLabel.string = text;
    }
  }

  private cellFromTouch(event: { getUILocation?: () => { x: number; y: number } }): CellPos | undefined {
    const location = event.getUILocation?.();
    if (!location || !this.boardRoot) return undefined;

    const transform = this.boardRoot.getComponent(UITransform);
    if (!transform) return undefined;

    const runtime = GameManager.instance.getRuntime();
    if (!runtime) return undefined;

    const { startX, startY, cellSize, gap } = this.boardMetrics;
    const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));
    const col = Math.round((local.x - startX) / (cellSize + gap));
    const row = Math.round((startY - local.y) / (cellSize + gap));
    if (row < 0 || row >= runtime.board.size || col < 0 || col >= runtime.board.size) return undefined;

    const centerX = startX + col * (cellSize + gap);
    const centerY = startY - row * (cellSize + gap);
    if (Math.abs(local.x - centerX) > cellSize / 2 || Math.abs(local.y - centerY) > cellSize / 2) return undefined;
    return { row, col };
  }

  private pathKey(path: CellPos[]): string {
    return path.map((cell) => this.cellKey(cell)).join('|');
  }

  private cellKey(pos: CellPos): string {
    return `${pos.row}:${pos.col}`;
  }

  private refreshCellStyles(): void {
    const runtime = GameManager.instance.getRuntime();
    if (!runtime) return;

    const selected = new Set(this.selectedPath.map((pos) => this.cellKey(pos)));
    const selectedColor = this.selectedPath.length > 0 ? this.colorForWord(this.selectedCandidateWord()) : SELECT_FALLBACK;

    this.cellViews.forEach((view) => {
      const foundWord = this.wordAt(view.pos);
      const isSelected = selected.has(this.cellKey(view.pos));
      const fill = foundWord ? this.colorForWord(foundWord) : isSelected ? selectedColor : undefined;
      const stroke = isSelected ? [222, 154, 42] : [173, 201, 188];
      this.drawCell(view.graphics, view.size, fill, stroke);
      view.label.color = foundWord ? Color.WHITE : new Color(32, 45, 53, 255);
    });
  }

  private drawCell(graphics: Graphics, size: number, fill?: number[], stroke = [173, 201, 188]): void {
    graphics.clear();
    graphics.fillColor = fill ? new Color(fill[0], fill[1], fill[2], 255) : Color.WHITE;
    graphics.strokeColor = new Color(stroke[0], stroke[1], stroke[2], 255);
    graphics.lineWidth = 3;
    graphics.roundRect(-size / 2, -size / 2, size, size, 12);
    graphics.fill();
    graphics.stroke();
  }

  private wordAt(pos: CellPos): string | undefined {
    const runtime = GameManager.instance.getRuntime();
    return runtime?.config.words.find((word) => runtime.foundWords.includes(word) && runtime.board.answers[word]?.some((cell) => cell.row === pos.row && cell.col === pos.col));
  }

  private selectedCandidateWord(): string | undefined {
    const runtime = GameManager.instance.getRuntime();
    if (!runtime || this.selectedPath.length === 0) return undefined;

    const selected = this.selectedPath.map((item) => runtime.board.cells[item.row][item.col]).join('');
    const reversed = selected.split('').reverse().join('');
    return runtime.config.words.find((word) => !runtime.foundWords.includes(word) && (word.startsWith(selected) || word.startsWith(reversed) || selected.startsWith(word) || reversed.startsWith(word)));
  }

  private colorForWord(word?: string): number[] {
    if (!word) return SELECT_FALLBACK;
    const runtime = GameManager.instance.getRuntime();
    const index = Math.max(0, runtime?.config.words.indexOf(word) ?? 0);
    return WORD_COLORS[index % WORD_COLORS.length];
  }
}
