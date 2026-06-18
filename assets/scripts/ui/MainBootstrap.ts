import {
  _decorator,
  Color,
  Component,
  Graphics,
  Label,
  Layers,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  UITransform,
  Vec3,
} from 'cc';
import { createLevelSpec, difficultyRankFor } from '../core/LevelGenerator';
import { getWordMeaning, preloadWordMeanings } from '../core/WordMeaning';
import { PlatformFactory } from '../platform/PlatformFactory';

const { ccclass } = _decorator;

interface Pos {
  row: number;
  col: number;
}

interface CellView {
  graphics: Graphics;
  label: Label;
  pos: Pos;
}

interface PlacementCandidate {
  path: Pos[];
  diagonal: boolean;
}

interface CanvasBounds {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const MAX_LEVELS = 300;
const MAX_LIVES = 3;
const MAX_STAMINA = 10;
const STAMINA_RECOVER_MS = 5 * 60 * 1000;
const SAVE_KEY = 'WORD_SEARCH_BOOTSTRAP_SAVE';
const LEVEL_SECONDS = 5 * 60;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CONTENT_WIDTH = 750;
const CONTENT_HEIGHT = 1334;
const BACKGROUND_BLUE = [142, 204, 244];
const DARK_BLUE = [25, 73, 146];
const SELECT_FALLBACK = [255, 209, 75];
const PATH_ALPHA = 255;
const FAILURE_MESSAGE = '挑战失败，继续加油！';
const FLAT_PALETTE = [
  [255, 190, 62],
  [85, 191, 255],
  [255, 114, 109],
  [91, 207, 133],
  [157, 126, 255],
  [255, 139, 74],
  [69, 197, 191],
  [237, 100, 166],
  [112, 171, 255],
  [255, 217, 95],
];

interface BootstrapSave {
  currentLevel: number;
  stamina: number;
  staminaUpdatedAt: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrateEnabled: boolean;
  tutorialSeen: boolean;
}

interface SimpleAudioContext {
  currentTime: number;
  destination: unknown;
  resume?: () => Promise<void>;
  createOscillator: () => {
    frequency: { value: number };
    type?: OscillatorType;
    connect: (node: unknown) => void;
    start: (time?: number) => void;
    stop: (time?: number) => void;
  };
  createGain: () => {
    gain: {
      value: number;
      exponentialRampToValueAtTime: (value: number, time: number) => void;
      setValueAtTime?: (value: number, time: number) => void;
    };
    connect: (node: unknown) => void;
  };
}

@ccclass('MainBootstrap')
export class MainBootstrap extends Component {
  private readonly platform = PlatformFactory.create();
  private screen: 'home' | 'game' = 'home';
  private levelIndex = 0;
  private boardSize = 6;
  private levelWords: string[] = [];
  private levelDifficulty = '简单';
  private board: string[][] = [];
  private answers: Record<string, Pos[]> = {};
  private found = new Set<string>();
  private selectedPath: Pos[] = [];
  private isDragging = false;
  private lives = MAX_LIVES;
  private timerRemaining = LEVEL_SECONDS;
  private timerStarted = false;
  private gameOver = false;
  private soundEnabled = true;
  private musicEnabled = true;
  private vibrateEnabled = true;
  private tutorialSeen = false;
  private stamina = MAX_STAMINA;
  private staminaUpdatedAt = Date.now();
  private staminaTick = 0;
  private rotating = false;
  private hintedCell?: Pos;
  private tutorialPath: Pos[] = [];
  private tutorialSequenceId = 0;

  private status?: Label;
  private timerLabel?: Label;
  private homeLevelLabel?: Label;
  private staminaPanelNode?: Node;
  private staminaPanel?: Graphics;
  private staminaIconNode?: Node;
  private staminaLabel?: Label;
  private staminaRecoverLabel?: Label;
  private wordLabels = new Map<string, Label>();
  private heartNodes: Node[] = [];
  private boardRoot?: Node;
  private pathGraphics?: Graphics;
  private toastNode?: Node;
  private meaningToastNode?: Node;
  private modalNode?: Node;
  private rewardNode?: Node;
  private nextButton?: Node;
  private contentRoot?: Node;
  private tutorialFingerNode?: Node;
  private tutorialWordLabel?: Label;
  private cellViews = new Map<string, CellView>();
  private boardMetrics = { startX: 0, startY: 0, cellSize: 0 };
  private iconCache = new Map<string, SpriteFrame>();
  private slideAudioContext?: SimpleAudioContext;

  start(): void {
    this.platform.init();
    preloadWordMeanings();
    this.loadProgress();
    this.showHome();
  }

  update(deltaTime: number): void {
    if (this.screen === 'home') {
      this.staminaTick += deltaTime;
      if (this.staminaTick >= 1) {
        this.staminaTick = 0;
        this.applyStaminaRecovery();
        this.refreshHomeInfo();
      }
      return;
    }

    if (!this.timerStarted || this.gameOver || this.rewardNode) return;
    this.timerRemaining = Math.max(0, this.timerRemaining - deltaTime);
    this.refreshTimer();
    if (this.timerRemaining <= 0) {
      this.failGame();
    }
  }

  private get words(): string[] {
    return this.levelWords;
  }

  private showHome(): void {
    this.screen = 'home';
    this.clearGameNodes();
    this.closeModal();
    this.rewardNode = undefined;
    this.toastNode = undefined;
    this.meaningToastNode = undefined;
    this.boardRoot = undefined;
    this.status = undefined;
    this.timerLabel = undefined;
    this.homeLevelLabel = undefined;
    this.staminaPanelNode = undefined;
    this.staminaPanel = undefined;
    this.staminaIconNode = undefined;
    this.staminaLabel = undefined;
    this.staminaRecoverLabel = undefined;
    this.tutorialPath = [];
    this.tutorialSequenceId += 1;
    this.tutorialFingerNode = undefined;
    this.tutorialWordLabel = undefined;
    this.applyStaminaRecovery();

    this.drawBrandBackground();
    this.renderHomeTopBar();
    this.renderHomeLogo();
    this.renderHomeStart();
    this.refreshHomeInfo();
  }

  private renderHomeTopBar(): void {
    const root = this.contentLayer();
    this.staminaPanel = this.graphicNode('StaminaPanel', root, -270, 525, 160, 58);
    this.staminaPanelNode = (this.staminaPanel as unknown as { node: Node }).node;
    this.staminaIconNode = this.imageNode('energy', -326, 525, 42, 42, root);
    this.staminaLabel = this.label('', -250, 525, 27, this.rgb(DARK_BLUE), root, 72);
    this.staminaRecoverLabel = this.label('', -250, 501, 17, this.rgb(DARK_BLUE, 210), root, 88);
  }

  private renderHomeLogo(): void {
    const logoWidth = 420;
    const logoAspectRatio = 360 / 240;
    this.imageNode('home_logo', 0, 150, logoWidth, logoWidth / logoAspectRatio, this.contentLayer(), '找词大师', true, logoAspectRatio);
  }

  private renderHomeStart(): void {
    this.button('开始游戏', 0, -365, 310, 78, () => this.startFromHome(), this.contentLayer(), DARK_BLUE, 32);
    this.homeLevelLabel = this.label('', 0, -438, 27, Color.WHITE, this.contentLayer(), 320);
  }

  private startFromHome(): void {
    this.applyStaminaRecovery();
    if (this.stamina <= 0) {
      this.refreshHomeInfo();
      this.showToast('体力不足，稍后再来');
      return;
    }

    this.consumeStamina();
    this.startCurrentLevel();
  }

  private loadProgress(): void {
    const saved = this.platform.getStorage<Partial<BootstrapSave>>(SAVE_KEY) ?? {};
    const currentLevel = Number.isFinite(saved.currentLevel) ? Number(saved.currentLevel) : 1;
    this.levelIndex = this.clamp(Math.floor(currentLevel), 1, MAX_LEVELS) - 1;
    this.stamina = this.clamp(Math.floor(saved.stamina ?? MAX_STAMINA), 0, MAX_STAMINA);
    this.staminaUpdatedAt = typeof saved.staminaUpdatedAt === 'number' ? saved.staminaUpdatedAt : Date.now();
    this.soundEnabled = saved.soundEnabled ?? true;
    this.musicEnabled = saved.musicEnabled ?? true;
    this.vibrateEnabled = saved.vibrateEnabled ?? true;
    this.tutorialSeen = saved.tutorialSeen ?? false;
    this.applyStaminaRecovery(false);
  }

  private saveProgress(): void {
    this.platform.setStorage<BootstrapSave>(SAVE_KEY, {
      currentLevel: this.levelIndex + 1,
      stamina: this.stamina,
      staminaUpdatedAt: this.staminaUpdatedAt,
      soundEnabled: this.soundEnabled,
      musicEnabled: this.musicEnabled,
      vibrateEnabled: this.vibrateEnabled,
      tutorialSeen: this.tutorialSeen,
    });
  }

  private applyStaminaRecovery(save = true): void {
    const now = Date.now();
    if (this.stamina >= MAX_STAMINA) {
      this.stamina = MAX_STAMINA;
      return;
    }

    const elapsed = Math.max(0, now - this.staminaUpdatedAt);
    const recovered = Math.floor(elapsed / STAMINA_RECOVER_MS);
    if (recovered <= 0) return;

    this.stamina = Math.min(MAX_STAMINA, this.stamina + recovered);
    this.staminaUpdatedAt = this.stamina >= MAX_STAMINA
      ? now
      : this.staminaUpdatedAt + recovered * STAMINA_RECOVER_MS;
    if (save) this.saveProgress();
  }

  private consumeStamina(): void {
    const wasFull = this.stamina >= MAX_STAMINA;
    this.stamina = Math.max(0, this.stamina - 1);
    if (wasFull) {
      this.staminaUpdatedAt = Date.now();
    }
    this.saveProgress();
  }

  private refreshHomeInfo(): void {
    if (this.homeLevelLabel) {
      this.homeLevelLabel.string = `当前第 ${this.levelIndex + 1} 关`;
    }
    if (this.staminaLabel) {
      this.staminaLabel.string = String(this.stamina);
    }
    const remaining = this.nextStaminaMs();
    const showCountdown = remaining > 0;
    if (this.staminaRecoverLabel) {
      this.staminaRecoverLabel.node.active = showCountdown;
      this.staminaRecoverLabel.string = showCountdown ? this.formatCountdown(remaining) : '';
    }
    this.layoutStaminaPanel(showCountdown);
  }

  private layoutStaminaPanel(showCountdown: boolean): void {
    const centerY = showCountdown ? 515 : 525;
    const height = showCountdown ? 78 : 58;
    if (this.staminaPanel) {
      const panel = this.staminaPanel;
      this.staminaPanelNode?.setPosition(-270, centerY);
      this.staminaPanelNode?.getComponent(UITransform)?.setContentSize(160, height);
      panel.clear();
      panel.fillColor = Color.WHITE;
      panel.roundRect(-80, -height / 2, 160, height, 20);
      panel.fill();
    }
    this.staminaIconNode?.setPosition(-326, showCountdown ? 526 : 525);
    this.staminaLabel?.node.setPosition(-250, showCountdown ? 532 : 525);
    this.staminaRecoverLabel?.node.setPosition(-250, 501);
  }

  private nextStaminaMs(): number {
    if (this.stamina >= MAX_STAMINA) return 0;
    const elapsed = Math.max(0, Date.now() - this.staminaUpdatedAt);
    return Math.max(0, STAMINA_RECOVER_MS - (elapsed % STAMINA_RECOVER_MS));
  }

  private prepareLevel(): void {
    const spec = createLevelSpec(this.levelIndex + 1);
    this.boardSize = spec.boardSize;
    this.levelWords = spec.words;
    this.levelDifficulty = spec.difficultyLabel;
  }

  private startCurrentLevel(): void {
    this.screen = 'game';
    this.clearGameNodes();
    this.found.clear();
    this.selectedPath = [];
    this.isDragging = false;
    this.lives = MAX_LIVES;
    this.timerRemaining = LEVEL_SECONDS;
    this.timerStarted = false;
    this.gameOver = false;
    this.rotating = false;
    this.hintedCell = undefined;
    this.tutorialPath = [];
    this.tutorialSequenceId += 1;
    this.tutorialFingerNode = undefined;
    this.tutorialWordLabel = undefined;
    this.prepareLevel();
    this.board = this.generateBoard();
    this.render();
    this.maybeShowFirstLevelTutorial();
  }

  private render(): void {
    this.wordLabels.clear();
    this.heartNodes = [];
    this.cellViews.clear();
    this.modalNode = undefined;
    this.rewardNode = undefined;

    this.drawBrandBackground(false);
    this.renderTopBar();
    this.renderWordPanel();
    this.renderBoardPanel();
    this.renderActionBar();
    this.refreshWords();
    this.refreshPathLayer();
  }

  private maybeShowFirstLevelTutorial(): void {
    if (this.levelIndex !== 0 || this.tutorialSeen) return;
    this.showTutorialDemo();
  }

  private showTutorialDemo(): void {
    const demoWords = this.words.filter((word) => (this.answers[word] ?? []).length > 1);
    if (demoWords.length === 0) return;

    const sequenceId = this.tutorialSequenceId + 1;
    this.tutorialSequenceId = sequenceId;
    this.closeModal();
    this.modalNode = new Node('TutorialDemo');
    this.modalNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(this.modalNode);

    const topPanel = this.graphicNode('TutorialPanel', this.modalNode, 0, 478, 640, 116);
    topPanel.fillColor = Color.WHITE;
    topPanel.roundRect(-320, -58, 640, 116, 24);
    topPanel.fill();
    topPanel.strokeColor = this.rgb(DARK_BLUE);
    topPanel.lineWidth = 4;
    topPanel.roundRect(-320, -58, 640, 116, 24);
    topPanel.stroke();
    this.label('看手指滑过字母，找到英文单词', 0, 506, 27, this.rgb(DARK_BLUE), this.modalNode, 560);
    this.tutorialWordLabel = this.label('', 0, 462, 31, new Color(255, 114, 109, 255), this.modalNode, 560);

    this.button('跳过引导', 0, -602, 230, 58, () => {
      this.finishTutorialDemo(true);
    }, this.modalNode, [255, 114, 109], 25);

    this.createTutorialFinger();
    this.animateTutorialWord(demoWords, 0, sequenceId);
  }

  private createTutorialFinger(): void {
    if (!this.boardRoot) return;
    if (this.tutorialFingerNode) {
      this.tutorialFingerNode.parent = null;
    }
    const finger = new Node('TutorialFinger');
    finger.layer = Layers.Enum.UI_2D;
    finger.active = false;
    this.boardRoot.addChild(finger);
    finger.addComponent(UITransform).setContentSize(58, 58);
    const graphics = finger.addComponent(Graphics);
    graphics.fillColor = new Color(255, 255, 255, 245);
    graphics.circle(0, 0, 26);
    graphics.fill();
    graphics.strokeColor = new Color(255, 114, 109, 255);
    graphics.lineWidth = 6;
    graphics.circle(0, 0, 26);
    graphics.stroke();
    graphics.fillColor = new Color(255, 114, 109, 255);
    graphics.circle(0, 0, 12);
    graphics.fill();
    this.tutorialFingerNode = finger;
  }

  private animateTutorialWord(words: string[], wordIndex: number, sequenceId: number): void {
    if (!this.isTutorialSequenceActive(sequenceId)) return;
    if (wordIndex >= words.length) {
      this.completeTutorialDemo(sequenceId);
      return;
    }

    const word = words[wordIndex];
    const path = this.answers[word] ?? [];
    if (!path.length) {
      this.animateTutorialWord(words, wordIndex + 1, sequenceId);
      return;
    }

    if (this.tutorialWordLabel) {
      this.tutorialWordLabel.string = `演示 ${wordIndex + 1}/${words.length}：${word}`;
    }
    this.tutorialPath = [];
    this.refreshPathLayer();

    const stepSeconds = 0.22;
    path.forEach((pos, pathIndex) => {
      this.scheduleOnce(() => {
        if (!this.isTutorialSequenceActive(sequenceId)) return;
        this.tutorialPath = path.slice(0, pathIndex + 1);
        const center = this.centerOf(pos);
        if (this.tutorialFingerNode) {
          this.tutorialFingerNode.active = true;
          this.tutorialFingerNode.setPosition(center.x, center.y);
        }
        this.playSlideSound(pos);
        this.refreshPathLayer();
      }, pathIndex * stepSeconds);
    });

    this.scheduleOnce(() => {
      if (!this.isTutorialSequenceActive(sequenceId)) return;
      this.tutorialPath = [];
      this.refreshPathLayer();
      this.animateTutorialWord(words, wordIndex + 1, sequenceId);
    }, path.length * stepSeconds + 0.46);
  }

  private completeTutorialDemo(sequenceId: number): void {
    if (!this.isTutorialSequenceActive(sequenceId)) return;
    this.tutorialPath = [];
    if (this.tutorialFingerNode) {
      this.tutorialFingerNode.active = false;
    }
    if (this.tutorialWordLabel) {
      this.tutorialWordLabel.string = '轮到你了，按住字母滑动找词';
    }
    this.refreshPathLayer();
    if (this.modalNode) {
      this.button('开始挑战', 0, -522, 250, 64, () => {
        this.finishTutorialDemo(true);
      }, this.modalNode, DARK_BLUE, 28);
    }
  }

  private finishTutorialDemo(markSeen: boolean): void {
    this.tutorialSequenceId += 1;
    this.tutorialPath = [];
    if (this.tutorialFingerNode) {
      this.tutorialFingerNode.parent = null;
      this.tutorialFingerNode = undefined;
    }
    this.tutorialWordLabel = undefined;
    if (markSeen) {
      this.tutorialSeen = true;
      this.saveProgress();
    }
    this.closeModal();
    this.refreshPathLayer();
  }

  private isTutorialSequenceActive(sequenceId: number): boolean {
    return this.screen === 'game' && this.modalNode?.name === 'TutorialDemo' && this.tutorialSequenceId === sequenceId;
  }

  private clearGameNodes(): void {
    [...this.node.children].forEach((child) => {
      if (child.name !== 'UICamera_Canvas') {
        child.parent = null;
      }
    });
    this.contentRoot = undefined;
    this.toastNode = undefined;
    this.meaningToastNode = undefined;
  }

  private drawBrandBackground(_showTools = true): void {
    const bounds = this.canvasBounds();
    const bg = this.graphicNode('BrandBackground', this.node, 0, 0, bounds.width, bounds.height);
    bg.fillColor = this.rgb(BACKGROUND_BLUE);
    bg.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    bg.fill();
  }

  private contentLayer(): Node {
    if (this.contentRoot?.parent) {
      this.applyContentScale(this.contentRoot);
      return this.contentRoot;
    }

    const root = new Node('SafeContentRoot');
    root.layer = Layers.Enum.UI_2D;
    root.setPosition(0, 0);
    root.addComponent(UITransform).setContentSize(CONTENT_WIDTH, CONTENT_HEIGHT);
    this.node.addChild(root);
    this.contentRoot = root;
    this.applyContentScale(root);
    return root;
  }

  private applyContentScale(root: Node): void {
    const bounds = this.canvasBounds();
    const scale = Math.min(1, bounds.width / CONTENT_WIDTH, bounds.height / CONTENT_HEIGHT);
    (root as unknown as { setScale?: (x: number, y?: number, z?: number) => void }).setScale?.(scale, scale, 1);
  }

  private renderTopBar(): void {
    this.iconButton('setting', '设', -315, 604, [255, 159, 28], () => this.showSettings(), 66);
    this.pill(`第 ${this.levelIndex + 1} 关`, 0, 604, 240, 56, [255, 255, 255], this.rgb(DARK_BLUE));
    this.renderHearts();
    this.timerLabel = this.label('', 0, 496, 27, Color.WHITE, this.contentLayer(), 220);
    this.refreshTimer();
  }

  private renderHearts(): void {
    this.heartNodes = [];
    [-62, 0, 62].forEach((x, index) => {
      const node = new Node(`Heart_${index}`);
      node.layer = Layers.Enum.UI_2D;
      node.setPosition(x, 545);
      this.contentLayer().addChild(node);
      node.addComponent(UITransform).setContentSize(24, 24);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.color = Color.WHITE;
      this.heartNodes.push(node);
    });
    this.refreshHearts();
  }

  private refreshHearts(): void {
    this.heartNodes.forEach((node, index) => {
      const active = index < this.lives;
      const textureName = active ? 'heart_red' : 'heart_gray';
      node.name = `Heart_${index}_${textureName}`;
      const sprite = node.getComponent(Sprite);
      if (!sprite) return;
      this.loadSpriteFrame(textureName, (frame) => {
        if (node.name === `Heart_${index}_${textureName}`) {
          sprite.spriteFrame = frame;
        }
      });
    });
  }

  private renderWordPanel(): void {
    const root = this.contentLayer();
    const panel = this.graphicNode('WordPanel', root, 0, 335, 650, 250);
    panel.fillColor = Color.WHITE;
    panel.roundRect(-325, -125, 650, 250, 16);
    panel.fill();
    panel.strokeColor = this.rgb(DARK_BLUE);
    panel.lineWidth = 4;
    panel.roundRect(-325, -125, 650, 250, 16);
    panel.stroke();

    this.words.forEach((word, index) => {
      const columns = this.words.length <= 4 ? 2 : 3;
      const col = index % columns;
      const row = Math.floor(index / columns);
      const rowCount = Math.ceil(this.words.length / columns);
      const x = (col - (columns - 1) / 2) * 205;
      const y = ((rowCount - 1) / 2 - row) * 54;
      const wordLabel = this.label(word, x, 335 + y, this.words.length > 8 ? 24 : 27, this.rgb(DARK_BLUE), root, 170);
      this.wordLabels.set(word, wordLabel);
    });
  }

  private renderBoardPanel(): void {
    if (this.boardRoot) {
      this.boardRoot.parent = null;
    }
    this.cellViews.clear();
    this.boardRoot = new Node('Board');
    this.boardRoot.layer = Layers.Enum.UI_2D;
    this.boardRoot.setPosition(0, -165);
    this.contentLayer().addChild(this.boardRoot);

    const boardWidth = 630;
    const cellSize = Math.floor(boardWidth / this.boardSize);
    const actual = cellSize * this.boardSize;
    const startX = -actual / 2 + cellSize / 2;
    const startY = actual / 2 - cellSize / 2;
    this.boardMetrics = { startX, startY, cellSize };
    this.boardRoot.addComponent(UITransform).setContentSize(actual, actual);

    const card = this.graphicNode('BoardCard', this.boardRoot, 0, 0, actual + 28, actual + 28);
    card.fillColor = Color.WHITE;
    card.roundRect(-(actual + 36) / 2, -(actual + 36) / 2, actual + 36, actual + 36, 18);
    card.fill();

    const pathNode = new Node('PathLayer');
    pathNode.layer = Layers.Enum.UI_2D;
    this.boardRoot.addChild(pathNode);
    pathNode.addComponent(UITransform).setContentSize(actual, actual);
    this.pathGraphics = pathNode.addComponent(Graphics);

    for (let row = 0; row < this.boardSize; row += 1) {
      for (let col = 0; col < this.boardSize; col += 1) {
        const pos = { row, col };
        const cell = new Node(`Cell_${row}_${col}`);
        cell.layer = Layers.Enum.UI_2D;
        cell.setPosition(startX + col * cellSize, startY - row * cellSize);
        cell.addComponent(UITransform).setContentSize(cellSize, cellSize);
        const graphics = cell.addComponent(Graphics);
        this.drawLetterTile(graphics, cellSize);
        const label = this.label(this.board[row][col], 0, 0, Math.max(25, Math.floor(cellSize * 0.44)), new Color(18, 24, 31, 255), cell, cellSize);
        this.cellViews.set(this.key(pos), { graphics, label, pos });
        cell.on('touch-start', () => this.beginDrag(pos), this);
        cell.on('touch-move', (event: { getUILocation?: () => { x: number; y: number } }) => this.moveDrag(event), this);
        cell.on('touch-end', (event: { getUILocation?: () => { x: number; y: number } }) => this.endDrag(event), this);
        cell.on('touch-cancel', (event: { getUILocation?: () => { x: number; y: number } }) => this.endDrag(event), this);
        this.boardRoot.addChild(cell);
      }
    }
  }

  private renderActionBar(): void {
    this.iconButton('tips', '灯', 185, -600, [255, 203, 47], () => this.showHintModal(), 70);
    this.iconButton('rotation', '↻', 315, -600, [255, 115, 37], () => this.rotateBoard(), 70);
    this.nextButton = this.circleButton('下关', 0, -600, [255, 115, 37], () => this.nextLevel(), 76);
    this.nextButton.active = false;
  }

  private beginDrag(pos: Pos): void {
    if (this.rewardNode || this.modalNode || this.gameOver || this.rotating) return;
    if (!this.timerStarted) {
      this.timerStarted = true;
      this.refreshTimer();
    }
    this.playSlideSound(pos);
    this.isDragging = true;
    this.selectedPath = [pos];
    this.refreshPathLayer();
  }

  private moveDrag(event: { getUILocation?: () => { x: number; y: number } }): void {
    if (!this.isDragging) return;
    const pos = this.cellFromTouch(event);
    const start = this.selectedPath[0];
    if (!pos || !start) return;
    const path = this.path(start, pos);
    if (path.length > 0 && this.pathKey(path) !== this.pathKey(this.selectedPath)) {
      this.playPathNotes(this.selectedPath, path);
      this.selectedPath = path;
      this.refreshPathLayer();
    }
  }

  private endDrag(event: { getUILocation?: () => { x: number; y: number } }): void {
    if (!this.isDragging) return;
    this.moveDrag(event);
    this.isDragging = false;
    const path = this.selectedPath;
    this.selectedPath = [];
    this.checkPath(path);
    this.refreshWords();
    this.refreshPathLayer();
  }

  private checkPath(path: Pos[]): void {
    if (path.length < 2) {
      return;
    }

    const selected = path.map((item) => this.board[item.row][item.col]).join('');
    const reversed = selected.split('').reverse().join('');
    const word = this.words.find((item) => !this.found.has(item) && (item === selected || item === reversed));
    if (!word) {
      this.loseLife();
      return;
    }

    this.found.add(word);
    this.playWordFoundFeedback(word);
    if (this.found.size === this.words.length) {
      if (this.nextButton) this.nextButton.active = true;
      this.gameOver = true;
      this.refreshTimer();
      this.scheduleOnce(() => {
        if (this.screen === 'game' && this.found.size === this.words.length) {
          this.showReward();
        }
      }, 0.75);
    }
  }

  private loseLife(): void {
    if (this.gameOver) return;
    this.lives = Math.max(0, this.lives - 1);
    this.refreshHearts();
    if (this.vibrateEnabled) {
      this.platform.vibrateShort();
    }
    if (this.lives <= 0) {
      this.failGame();
    }
  }

  private failGame(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.isDragging = false;
    this.selectedPath = [];
    this.refreshTimer();
    this.refreshPathLayer();
    this.showModal('游戏结束', (root) => {
      this.label(FAILURE_MESSAGE, 0, 60, 30, new Color(80, 90, 102, 255), root, 430);
      this.button('返回主页', -135, -108, 220, 64, () => {
        this.closeModal();
        this.returnHome();
      }, root, DARK_BLUE, 25);
      this.button('重新开始', 135, -108, 220, 64, () => {
        this.closeModal();
        this.restart();
      }, root, [255, 115, 37], 25);
    }, false);
  }

  private restart(): void {
    this.startCurrentLevel();
  }

  private returnHome(): void {
    this.showHome();
  }

  private nextLevel(): void {
    this.levelIndex = Math.min(MAX_LEVELS - 1, this.levelIndex + 1);
    this.saveProgress();
    this.startCurrentLevel();
  }

  private shareLevelClear(): void {
    const level = this.levelIndex + 1;
    this.platform.share({
      title: `我通过找词大师第 ${level} 关了，快来一起挑战！`,
      query: `from=clear-share&level=${level}`,
      imageUrl: 'icon.png',
    });
  }

  private rotateBoard(): void {
    if (this.gameOver || this.rewardNode || this.modalNode || this.rotating || !this.boardRoot) return;
    this.rotating = true;
    this.isDragging = false;
    this.selectedPath = [];
    this.refreshPathLayer();
    this.playSlideSound();

    const root = this.boardRoot;
    root.angle = 0;
    tween(root)
      .to(0.28, { angle: -90 }, { easing: 'backInOut' })
      .call(() => {
        this.applyBoardRotation();
        root.parent = null;
        this.renderBoardPanel();
        this.refreshPathLayer();
        this.rotating = false;
      })
      .start();
  }

  private applyBoardRotation(): void {
    const size = this.boardSize;
    const rotated = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        rotated[row][col] = this.board[size - 1 - col][row];
      }
    }
    Object.keys(this.answers).forEach((word) => {
      this.answers[word] = this.answers[word].map((pos) => ({ row: pos.col, col: size - 1 - pos.row }));
    });
    this.board = rotated;
    this.hintedCell = this.hintedCell ? { row: this.hintedCell.col, col: size - 1 - this.hintedCell.row } : undefined;
  }

  private showSettings(): void {
    this.showModal('设置', (root) => {
      this.switchControl('声音', this.soundEnabled, 0, 90, () => {
        this.soundEnabled = !this.soundEnabled;
        this.saveProgress();
        this.showSettings();
      }, root);
      this.switchControl('音乐', this.musicEnabled, 0, 18, () => {
        this.musicEnabled = !this.musicEnabled;
        this.saveProgress();
        this.showSettings();
      }, root);
      this.switchControl('振动', this.vibrateEnabled, 0, -54, () => {
        this.vibrateEnabled = !this.vibrateEnabled;
        this.saveProgress();
        this.showSettings();
      }, root);
      this.button('返回主页', -135, -150, 220, 58, () => {
        this.closeModal();
        this.returnHome();
      }, root, [72, 117, 198]);
      this.button('重新开始', 135, -150, 220, 58, () => {
        this.closeModal();
        this.restart();
      }, root, [220, 95, 82]);
    });
  }

  private showHintModal(): void {
    if (this.gameOver || this.rewardNode) return;
    this.showModal('提示', (root) => {
      this.label('帮你找到单词首字母开始位置', 0, 58, 25, new Color(45, 56, 68, 255), root, 430);
      this.button('免费试用', 0, -86, 240, 64, () => {
        this.closeModal();
        this.revealHint();
      }, root, [255, 176, 47]);
    });
  }

  private revealHint(): void {
    const word = this.words.find((item) => !this.found.has(item));
    const pos = word ? this.answers[word]?.[0] : undefined;
    if (!word || !pos) return;
    this.hintedCell = pos;
    this.setStatus(`已标出 ${word} 的首字母`);
    this.refreshPathLayer();
  }

  private showModal(title: string, content: (root: Node) => void, showClose = true): void {
    this.closeModal();
    this.modalNode = new Node(`Modal_${title}`);
    this.modalNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(this.modalNode);
    const overlay = this.modalNode.addComponent(Graphics);
    const bounds = this.canvasBounds();
    overlay.fillColor = new Color(20, 68, 126, 112);
    overlay.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    overlay.fill();

    const card = this.graphicNode('ModalCard', this.modalNode, 0, 0, 580, 440);
    card.fillColor = Color.WHITE;
    card.roundRect(-290, -220, 580, 440, 26);
    card.fill();
    card.strokeColor = this.rgb(DARK_BLUE);
    card.lineWidth = 4;
    card.roundRect(-290, -220, 580, 440, 26);
    card.stroke();
    card.fillColor = this.rgb(DARK_BLUE);
    card.roundRect(-290, 126, 580, 94, 26);
    card.fill();
    card.rect(-290, 126, 580, 47);
    card.fill();
    this.label(title, 0, 172, 34, Color.WHITE, this.modalNode, 420);
    if (showClose) {
      this.circleButton('×', 242, 172, [255, 114, 109], () => this.closeModal(), 44, this.modalNode);
    }
    content(this.modalNode);
  }

  private closeModal(): void {
    if (this.modalNode) {
      this.modalNode.parent = null;
      this.modalNode = undefined;
    }
  }

  private showToast(text: string): void {
    if (this.toastNode) this.toastNode.parent = null;
    this.toastNode = new Node('Toast');
    this.toastNode.layer = Layers.Enum.UI_2D;
    this.toastNode.setPosition(0, 188);
    this.node.addChild(this.toastNode);
    const g = this.toastNode.addComponent(Graphics);
    g.fillColor = new Color(199, 35, 137, 230);
    g.roundRect(-185, -25, 370, 50, 25);
    g.fill();
    this.label(text, 0, 0, 28, Color.WHITE, this.toastNode, 340);
    const toast = this.toastNode;
    this.scheduleOnce(() => {
      if (this.toastNode === toast) {
        this.toastNode.parent = null;
        this.toastNode = undefined;
      }
    }, 0.9);
  }

  private playWordFoundFeedback(word: string): void {
    if (this.soundEnabled) {
      this.platform.speakWord(word);
    }
    this.showMeaningToast(word);
  }

  private showMeaningToast(word: string): void {
    if (this.meaningToastNode) this.meaningToastNode.parent = null;

    const text = `${word}：${getWordMeaning(word)}`;
    const root = this.contentLayer();
    const toast = new Node('WordMeaningToast');
    toast.layer = Layers.Enum.UI_2D;
    toast.setPosition(0, -512);
    root.addChild(toast);
    toast.addComponent(UITransform).setContentSize(590, 62);

    const g = toast.addComponent(Graphics);
    g.fillColor = new Color(25, 73, 146, 235);
    g.roundRect(-295, -31, 590, 62, 31);
    g.fill();
    this.label(text, 0, 0, 25, Color.WHITE, toast, 530);

    this.meaningToastNode = toast;
    this.scheduleOnce(() => {
      if (this.meaningToastNode === toast) {
        this.meaningToastNode.parent = null;
        this.meaningToastNode = undefined;
      }
    }, 1.5);
  }

  private showCelebration(parent: Node): void {
    const colors = [
      [255, 209, 75],
      [255, 114, 109],
      [75, 190, 255],
      [83, 214, 139],
      [156, 126, 255],
      [255, 151, 71],
    ];
    for (let index = 0; index < 24; index += 1) {
      const piece = new Node(`Confetti_${index}`);
      piece.layer = Layers.Enum.UI_2D;
      const startX = -300 + (index % 8) * 86;
      const startY = 410 + Math.floor(index / 8) * 42;
      piece.setPosition(startX, startY);
      parent.addChild(piece);
      piece.addComponent(UITransform).setContentSize(18, 18);
      const g = piece.addComponent(Graphics);
      const color = colors[index % colors.length];
      g.fillColor = this.rgb(color);
      if (index % 2 === 0) {
        g.rect(-8, -5, 16, 10);
      } else {
        g.circle(0, 0, 7);
      }
      g.fill();

      for (let step = 1; step <= 8; step += 1) {
        this.scheduleOnce(() => {
          const drift = ((index % 3) - 1) * step * 9;
          piece.setPosition(startX + drift, startY - step * 54);
          piece.angle = step * 28 + index * 7;
        }, step * 0.08);
      }
      this.scheduleOnce(() => {
        piece.parent = null;
      }, 0.85);
    }
  }

  private showReward(): void {
    if (this.rewardNode) return;
    this.rewardNode = new Node('Reward');
    this.rewardNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(this.rewardNode);
    const overlay = this.rewardNode.addComponent(Graphics);
    const bounds = this.canvasBounds();
    overlay.fillColor = new Color(20, 68, 126, 112);
    overlay.rect(bounds.left, bounds.bottom, bounds.width, bounds.height);
    overlay.fill();
    this.showCelebration(this.rewardNode);

    const card = this.graphicNode('RewardCard', this.rewardNode, 0, 0, 560, 430);
    card.fillColor = Color.WHITE;
    card.roundRect(-280, -215, 560, 430, 28);
    card.fill();
    card.strokeColor = this.rgb(DARK_BLUE);
    card.lineWidth = 4;
    card.roundRect(-280, -215, 560, 430, 28);
    card.stroke();
    card.fillColor = this.rgb(DARK_BLUE);
    card.roundRect(-280, 103, 560, 112, 28);
    card.fill();
    card.rect(-280, 103, 560, 56);
    card.fill();
    this.label('通关成功', 0, 160, 40, Color.WHITE, this.rewardNode, 480);
    this.label(`第 ${this.levelIndex + 1} 关完成`, 0, 52, 34, this.rgb(DARK_BLUE), this.rewardNode, 480);
    this.circleButton('分享', -112, -132, [69, 197, 191], () => this.shareLevelClear(), 108, this.rewardNode);
    this.circleButton('下一关', 112, -132, DARK_BLUE, () => this.nextLevel(), 118, this.rewardNode);
  }

  private refreshWords(): void {
    this.words.forEach((word) => {
      const label = this.wordLabels.get(word);
      if (!label) return;
      label.color = this.found.has(word) ? new Color(178, 184, 188, 255) : new Color(24, 42, 52, 255);
      label.string = this.found.has(word) ? `${word} ✓` : word;
    });
  }

  private refreshTimer(): void {
    if (!this.timerLabel) return;
    this.timerLabel.node.active = this.screen === 'game' && this.timerStarted && !this.gameOver;
    if (!this.timerLabel.node.active) return;
    const total = Math.ceil(this.timerRemaining);
    const minute = Math.floor(total / 60).toString().padStart(2, '0');
    const second = (total % 60).toString().padStart(2, '0');
    this.timerLabel.string = `${minute}:${second}`;
  }

  private refreshPathLayer(): void {
    const g = this.pathGraphics;
    if (!g) return;
    g.clear();
    this.words.forEach((word) => {
      if (this.found.has(word)) {
        this.drawPath(g, this.answers[word] ?? [], this.colorForWord(word), PATH_ALPHA);
      }
    });
    if (this.hintedCell && !this.wordAt(this.hintedCell)) {
      this.drawPath(g, [this.hintedCell], [255, 195, 61], PATH_ALPHA);
    }
    if (this.tutorialPath.length > 0) {
      this.drawPath(g, this.tutorialPath, [255, 114, 109], 220);
    }
    const selectedColor = this.colorForWord(this.selectedCandidateWord());
    if (this.selectedPath.length > 0) {
      this.drawPath(g, this.selectedPath, selectedColor, PATH_ALPHA);
    }
    this.cellViews.forEach((view) => {
      const word = this.wordAt(view.pos);
      const selected = this.isSelected(view.pos);
      const hinted = this.isHinted(view.pos);
      const tutorial = this.isTutorial(view.pos);
      const active = Boolean(word || selected || hinted || tutorial);
      const color = word ? this.colorForWord(word) : hinted ? [255, 195, 61] : tutorial ? [255, 114, 109] : selected ? selectedColor : undefined;
      this.drawLetterTile(view.graphics, this.boardMetrics.cellSize, color);
      view.label.color = active ? Color.WHITE : new Color(18, 24, 31, 255);
    });
  }

  private drawLetterTile(graphics: Graphics, _size: number, _color?: number[]): void {
    graphics.clear();
  }

  private drawPath(graphics: Graphics, path: Pos[], color: number[], alpha: number): void {
    if (path.length === 0) return;
    const { cellSize } = this.boardMetrics;
    const radius = cellSize * 0.34;
    graphics.fillColor = new Color(color[0], color[1], color[2], alpha);
    graphics.strokeColor = new Color(color[0], color[1], color[2], alpha);
    graphics.lineWidth = cellSize * 0.68;
    const first = this.centerOf(path[0]);
    graphics.moveTo(first.x, first.y);
    path.slice(1).forEach((pos) => {
      const center = this.centerOf(pos);
      graphics.lineTo(center.x, center.y);
    });
    graphics.stroke();
    path.forEach((pos) => {
      const center = this.centerOf(pos);
      graphics.circle(center.x, center.y, radius);
      graphics.fill();
    });
  }

  private generateBoard(): string[][] {
    const startingSize = this.boardSize;
    const passes = [
      { enforceDiagonal: true, attempts: 50 },
      { enforceDiagonal: false, attempts: 190 },
    ];

    for (let size = startingSize; size <= 11; size += 1) {
      this.boardSize = size;
      for (const pass of passes) {
        for (let attempt = 0; attempt < pass.attempts; attempt += 1) {
          const generated = this.tryGenerateBoard(size, pass.enforceDiagonal);
          if (generated) {
            this.answers = generated.answers;
            return generated.board;
          }
        }
      }
    }

    throw new Error(`Cannot generate solvable board for level ${this.levelIndex + 1}.`);
  }

  private tryGenerateBoard(size: number, enforceDiagonal: boolean): { board: string[][]; answers: Record<string, Pos[]> } | undefined {
    const board = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
    const answers: Record<string, Pos[]> = {};
    const dirs = [
      [0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1],
    ];
    const diagonalTarget = this.diagonalTargetForLevel();
    let diagonalPlaced = 0;

    for (const word of [...this.words].sort((a, b) => b.length - a.length)) {
      const candidates: PlacementCandidate[] = [];
      dirs.forEach(([dr, dc]) => {
        for (let row = 0; row < size; row += 1) {
          for (let col = 0; col < size; col += 1) {
            const path = Array.from({ length: word.length }, (_, index) => ({ row: row + dr * index, col: col + dc * index }));
            if (!path.every((pos) => pos.row >= 0 && pos.row < size && pos.col >= 0 && pos.col < size)) continue;
            if (!path.every((pos, index) => board[pos.row][pos.col] === '' || board[pos.row][pos.col] === word[index])) continue;
            candidates.push({ path, diagonal: dr !== 0 && dc !== 0 });
          }
        }
      });

      if (candidates.length === 0) {
        return undefined;
      }

      const candidate = this.pickPlacementCandidate(candidates, enforceDiagonal && diagonalPlaced < diagonalTarget);
      const { path } = candidate;
      path.forEach((pos, index) => {
        board[pos.row][pos.col] = word[index];
      });
      answers[word] = path;
      if (candidate.diagonal) {
        diagonalPlaced += 1;
      }
    }

    for (const word of this.words) {
      if (!answers[word]) {
        return undefined;
      }
    }

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!board[row][col]) {
          board[row][col] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
        }
      }
    }

    return { board, answers };
  }

  private diagonalTargetForLevel(): number {
    if (this.words.length === 0) return 0;
    const rank = difficultyRankFor(this.levelIndex + 1);
    const ratio = rank <= 2 ? 0.1 : rank === 3 ? 0.16 : rank === 4 ? 0.22 : 0.26;
    return this.clamp(Math.round(this.words.length * ratio), 1, this.words.length);
  }

  private pickPlacementCandidate(candidates: PlacementCandidate[], preferDiagonal: boolean): PlacementCandidate {
    const diagonalCandidates = candidates.filter((candidate) => candidate.diagonal);
    const pool = preferDiagonal && diagonalCandidates.length > 0 ? diagonalCandidates : candidates;
    const totalWeight = pool.reduce((sum, candidate) => sum + this.placementWeight(candidate, preferDiagonal), 0);
    let cursor = Math.random() * totalWeight;

    for (const candidate of pool) {
      cursor -= this.placementWeight(candidate, preferDiagonal);
      if (cursor <= 0) {
        return candidate;
      }
    }

    return pool[pool.length - 1];
  }

  private placementWeight(candidate: PlacementCandidate, preferDiagonal: boolean): number {
    if (candidate.diagonal) return preferDiagonal ? 2 : 1;
    return preferDiagonal ? 1 : 4;
  }

  private path(start: Pos, end: Pos): Pos[] {
    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);
    const rowDistance = Math.abs(rowDelta);
    const colDistance = Math.abs(colDelta);
    if (!(rowDistance === 0 || colDistance === 0 || rowDistance === colDistance)) return [];
    const length = Math.max(rowDistance, colDistance);
    return Array.from({ length: length + 1 }, (_, index) => ({ row: start.row + rowStep * index, col: start.col + colStep * index }));
  }

  private cellFromTouch(event: { getUILocation?: () => { x: number; y: number } }): Pos | undefined {
    const location = event.getUILocation?.();
    if (!location || !this.boardRoot) return undefined;
    const transform = this.boardRoot.getComponent(UITransform);
    if (!transform) return undefined;
    const { startX, startY, cellSize } = this.boardMetrics;
    const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));
    const col = Math.round((local.x - startX) / cellSize);
    const row = Math.round((startY - local.y) / cellSize);
    if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return undefined;
    const center = this.centerOf({ row, col });
    if (Math.abs(local.x - center.x) > cellSize / 2 || Math.abs(local.y - center.y) > cellSize / 2) return undefined;
    return { row, col };
  }

  private label(text: string, x: number, y: number, fontSize: number, color: Color, parent = this.contentLayer(), width = 690): Label {
    const node = new Node(`Label_${text}`);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, fontSize + 18);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.horizontalAlign = 1;
    label.verticalAlign = 1;
    label.fontFamily = 'Arial Rounded MT Bold, PingFang SC, Microsoft YaHei, sans-serif';
    label.isBold = true;
    label.color = color;
    return label;
  }

  private brandTitle(text: string, x: number, y: number): void {
    const root = this.contentLayer();
    this.label(text, x + 5, y - 7, 58, new Color(21, 39, 112, 255), root, 360);
    this.label(text, x - 3, y + 3, 58, Color.WHITE, root, 360);
    this.label(text, x, y, 58, new Color(255, 216, 37, 255), root, 360);
  }

  private drawLogoBadge(x: number, y: number): void {
    const g = this.graphicNode('LogoBadge', this.contentLayer(), x, y, 460, 190);
    g.fillColor = new Color(30, 43, 91, 72);
    g.roundRect(-218, -104, 460, 190, 34);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 56);
    g.roundRect(-230, -88, 460, 176, 34);
    g.fill();
    g.strokeColor = new Color(255, 228, 79, 210);
    g.lineWidth = 6;
    g.roundRect(-230, -88, 460, 176, 34);
    g.stroke();
  }

  private button(text: string, x: number, y: number, width: number, height: number, handler: () => void, parent = this.contentLayer(), color = [20, 178, 76], fontSize = 24): Node {
    const node = new Node(`Button_${text}`);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    const g = node.addComponent(Graphics);
    g.fillColor = this.rgb(color);
    g.roundRect(-width / 2, -height / 2, width, height, 16);
    g.fill();
    this.label(text, 0, 0, fontSize, Color.WHITE, node, width - 16);
    node.on('touch-end', handler, this);
    return node;
  }

  private toggleButton(text: string, x: number, y: number, handler: () => void, parent: Node): Node {
    return this.button(text, x, y, 230, 58, handler, parent, [28, 46, 76]);
  }

  private switchControl(text: string, checked: boolean, x: number, y: number, handler: () => void, parent: Node): Node {
    const row = new Node(`SwitchRow_${text}`);
    row.layer = Layers.Enum.UI_2D;
    row.setPosition(x, y);
    parent.addChild(row);
    row.addComponent(UITransform).setContentSize(420, 60);
    this.label(text, -120, 0, 25, this.rgb(DARK_BLUE), row, 160);

    const switchNode = new Node(`Switch_${text}`);
    switchNode.layer = Layers.Enum.UI_2D;
    switchNode.setPosition(118, 0);
    row.addChild(switchNode);
    switchNode.addComponent(UITransform).setContentSize(88, 48);
    const g = switchNode.addComponent(Graphics);
    g.fillColor = checked ? new Color(52, 199, 89, 255) : new Color(196, 202, 211, 255);
    g.roundRect(-44, -24, 88, 48, 24);
    g.fill();
    g.fillColor = Color.WHITE;
    g.circle(checked ? 20 : -20, 0, 20);
    g.fill();
    row.on('touch-end', handler, this);
    return row;
  }

  private circleButton(text: string, x: number, y: number, color: number[], handler: () => void, size = 68, parent = this.contentLayer()): Node {
    const node = new Node(`Circle_${text}`);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(size, size);
    const g = node.addComponent(Graphics);
    g.fillColor = this.rgb(color);
    g.circle(0, 0, size / 2);
    g.fill();
    this.label(text, 0, 0, size > 50 ? 22 : 24, Color.WHITE, node, size);
    node.on('touch-end', handler, this);
    return node;
  }

  private iconButton(iconName: string, fallback: string, x: number, y: number, color: number[], handler: () => void, size = 68, parent = this.contentLayer()): Node {
    const node = new Node(`IconButton_${iconName}`);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(size, size);
    node.name = `IconButton_${iconName}`;
    const bg = node.addComponent(Graphics);
    bg.fillColor = Color.WHITE;
    bg.circle(0, 0, size / 2);
    bg.fill();
    bg.strokeColor = this.rgb(DARK_BLUE);
    bg.lineWidth = 3;
    bg.circle(0, 0, size / 2);
    bg.stroke();
    const fallbackLabel = this.label(fallback, 0, 0, size > 50 ? 22 : 24, this.rgb(color), node, size);
    const iconNode = new Node(`Icon_${iconName}`);
    iconNode.layer = Layers.Enum.UI_2D;
    iconNode.setPosition(0, 0);
    node.addChild(iconNode);
    iconNode.addComponent(UITransform).setContentSize(size * 0.7, size * 0.7);
    const sprite = iconNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.color = Color.WHITE;
    this.loadIcon(iconName, sprite, fallbackLabel);
    node.on('touch-end', handler, this);
    return node;
  }

  private loadIcon(iconName: string, sprite: Sprite, fallbackLabel: Label): void {
    const cached = this.iconCache.get(iconName);
    if (cached) {
      sprite.spriteFrame = cached;
      fallbackLabel.node.active = false;
      return;
    }

    resources.load(`texture/${iconName}/spriteFrame`, SpriteFrame, (error: Error | null, frame: SpriteFrame) => {
      if (error || !frame) return;
      this.iconCache.set(iconName, frame);
      sprite.spriteFrame = frame;
      fallbackLabel.node.active = false;
    });
  }

  private loadSpriteFrame(name: string, onLoaded: (frame: SpriteFrame) => void): void {
    const cached = this.iconCache.get(name);
    if (cached) {
      onLoaded(cached);
      return;
    }

    resources.load(`texture/${name}/spriteFrame`, SpriteFrame, (error: Error | null, frame: SpriteFrame) => {
      if (error || !frame) return;
      this.iconCache.set(name, frame);
      onLoaded(frame);
    });
  }

  private imageNode(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    parent = this.contentLayer(),
    fallbackText = '',
    preserveAspect = false,
    fallbackAspectRatio?: number,
  ): Node {
    const node = new Node(`Image_${name}`);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    if (preserveAspect) {
      this.fitImageAspect(node, width, height, fallbackAspectRatio);
    }
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.color = Color.WHITE;
    if (preserveAspect) {
      (sprite as unknown as { trim?: boolean }).trim = false;
    }
    const fallbackLabel = fallbackText
      ? this.label(fallbackText, 0, 0, 34, this.rgb(DARK_BLUE), node, width)
      : undefined;

    const cached = this.iconCache.get(name);
    if (cached) {
      if (preserveAspect) {
        this.fitImageAspect(node, width, height, fallbackAspectRatio ?? this.aspectRatioForFrame(cached));
      }
      sprite.spriteFrame = cached;
      if (fallbackLabel) fallbackLabel.node.active = false;
      return node;
    }

    resources.load(`texture/${name}/spriteFrame`, SpriteFrame, (error: Error | null, frame: SpriteFrame) => {
      if (error || !frame) return;
      this.iconCache.set(name, frame);
      if (preserveAspect) {
        this.fitImageAspect(node, width, height, fallbackAspectRatio ?? this.aspectRatioForFrame(frame));
      }
      sprite.spriteFrame = frame;
      if (fallbackLabel) fallbackLabel.node.active = false;
    });
    return node;
  }

  private fitImageAspect(node: Node, maxWidth: number, maxHeight: number, aspectRatio?: number): void {
    if (!aspectRatio || aspectRatio <= 0) return;
    const transform = node.getComponent(UITransform);
    if (!transform) return;
    let width = maxWidth;
    let height = width / aspectRatio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
    transform.setContentSize(width, height);
  }

  private aspectRatioForFrame(frame: SpriteFrame): number | undefined {
    const frameLike = frame as unknown as {
      originalSize?: { width: number; height: number };
      rect?: { width: number; height: number };
      getOriginalSize?: () => { width: number; height: number };
    };
    const size = frameLike.getOriginalSize?.() ?? frameLike.originalSize ?? frameLike.rect;
    if (!size?.width || !size.height) return undefined;
    return size.width / size.height;
  }

  private pill(text: string, x: number, y: number, width: number, height: number, color: number[], labelColor: Color): void {
    const parent = this.contentLayer();
    const g = this.graphicNode(`Pill_${text}`, parent, x, y, width, height);
    g.fillColor = this.rgb(color);
    g.roundRect(-width / 2, -height / 2, width, height, height / 2);
    g.fill();
    this.label(text, x, y, 22, labelColor, parent, width - 18);
  }

  private graphicNode(name: string, parent: Node, x: number, y: number, width: number, height: number): Graphics {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(x, y);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    return node.addComponent(Graphics);
  }

  private canvasBounds(): CanvasBounds {
    const transform = this.node.getComponent(UITransform) as unknown as {
      contentSize?: { width?: number; height?: number };
      getContentSize?: () => { width?: number; height?: number };
      width?: number;
      height?: number;
    } | null;
    const size = transform?.getContentSize?.() ?? transform?.contentSize;
    const width = this.validSize(size?.width ?? transform?.width, 750);
    const height = this.validSize(size?.height ?? transform?.height, 1334);
    return {
      width,
      height,
      left: -width / 2,
      right: width / 2,
      top: height / 2,
      bottom: -height / 2,
    };
  }

  private validSize(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private createGradientPalette(): number[][] {
    const sets = [
      [[48, 205, 236], [255, 214, 82], [255, 112, 104]],
      [[64, 217, 142], [72, 170, 255], [255, 195, 70]],
      [[255, 132, 82], [105, 212, 255], [126, 224, 116]],
    ];
    return sets[Math.floor(Math.random() * sets.length)];
  }

  private mixColor(a: number[], b: number[], t: number): number[] {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  private centerOf(pos: Pos): { x: number; y: number } {
    const { startX, startY, cellSize } = this.boardMetrics;
    return { x: startX + pos.col * cellSize, y: startY - pos.row * cellSize };
  }

  private selectedCandidateWord(): string | undefined {
    const selected = this.selectedPath.map((item) => this.board[item.row][item.col]).join('');
    const reversed = selected.split('').reverse().join('');
    return this.words.find((word) => !this.found.has(word) && (word.startsWith(selected) || word.startsWith(reversed) || selected.startsWith(word) || reversed.startsWith(word)));
  }

  private wordAt(pos: Pos): string | undefined {
    return this.words.find((word) => this.found.has(word) && this.answers[word]?.some((item) => item.row === pos.row && item.col === pos.col));
  }

  private isSelected(pos: Pos): boolean {
    return this.selectedPath.some((item) => item.row === pos.row && item.col === pos.col);
  }

  private isHinted(pos: Pos): boolean {
    return Boolean(this.hintedCell && this.hintedCell.row === pos.row && this.hintedCell.col === pos.col);
  }

  private isTutorial(pos: Pos): boolean {
    return this.tutorialPath.some((item) => item.row === pos.row && item.col === pos.col);
  }

  private colorForWord(word?: string): number[] {
    if (!word) return SELECT_FALLBACK;
    const index = Math.max(0, this.words.indexOf(word));
    return FLAT_PALETTE[index % FLAT_PALETTE.length];
  }

  private pathKey(path: Pos[]): string {
    return path.map((pos) => this.key(pos)).join('|');
  }

  private key(pos: Pos): string {
    return `${pos.row}:${pos.col}`;
  }

  private rgb(values: number[], alpha = 255): Color {
    return new Color(values[0], values[1], values[2], alpha);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private formatCountdown(milliseconds: number): string {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minute = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const second = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minute}:${second}`;
  }

  private drawStar(graphics: Graphics, x: number, y: number, radius: number): void {
    graphics.fillColor = new Color(255, 231, 66, 230);
    graphics.moveTo(x, y + radius);
    graphics.lineTo(x + radius * 0.28, y + radius * 0.28);
    graphics.lineTo(x + radius, y);
    graphics.lineTo(x + radius * 0.28, y - radius * 0.28);
    graphics.lineTo(x, y - radius);
    graphics.lineTo(x - radius * 0.28, y - radius * 0.28);
    graphics.lineTo(x - radius, y);
    graphics.lineTo(x - radius * 0.28, y + radius * 0.28);
    graphics.close();
    graphics.fill();
  }

  private drawFloatingLetter(graphics: Graphics, x: number, y: number, letter: string, color: number[]): void {
    graphics.fillColor = new Color(32, 43, 88, 58);
    graphics.roundRect(x - 31, y - 36, 62, 62, 14);
    graphics.fill();
    graphics.fillColor = this.rgb(color, 218);
    graphics.roundRect(x - 34, y - 29, 62, 62, 14);
    graphics.fill();
    graphics.strokeColor = new Color(255, 255, 255, 120);
    graphics.lineWidth = 3;
    graphics.roundRect(x - 34, y - 29, 62, 62, 14);
    graphics.stroke();
    this.label(letter, x - 3, y + 2, 28, Color.WHITE, this.contentLayer(), 52);
  }

  private drawMagnifier(graphics: Graphics, x: number, y: number): void {
    graphics.fillColor = new Color(255, 171, 43, 255);
    graphics.roundRect(x - 55, y - 80, 28, 92, 14);
    graphics.fill();
    graphics.fillColor = new Color(255, 247, 220, 255);
    graphics.circle(x, y, 56);
    graphics.fill();
    graphics.strokeColor = new Color(255, 171, 43, 255);
    graphics.lineWidth = 12;
    graphics.circle(x, y, 56);
    graphics.stroke();
    graphics.fillColor = new Color(48, 88, 160, 255);
    graphics.circle(x, y, 32);
    graphics.fill();
    this.label('W', x, y, 26, Color.WHITE, this.contentLayer(), 54);
  }

  private drawPencil(graphics: Graphics, x: number, y: number): void {
    graphics.fillColor = new Color(255, 121, 43, 255);
    graphics.roundRect(x - 22, y - 74, 44, 116, 18);
    graphics.fill();
    graphics.fillColor = new Color(255, 236, 92, 255);
    graphics.rect(x - 22, y + 2, 44, 32);
    graphics.fill();
    graphics.fillColor = new Color(255, 245, 220, 255);
    graphics.moveTo(x - 22, y + 42);
    graphics.lineTo(x + 22, y + 42);
    graphics.lineTo(x, y + 78);
    graphics.close();
    graphics.fill();
    graphics.fillColor = new Color(58, 67, 86, 255);
    graphics.moveTo(x - 8, y + 58);
    graphics.lineTo(x + 8, y + 58);
    graphics.lineTo(x, y + 78);
    graphics.close();
    graphics.fill();
  }

  private setStatus(text: string): void {
    if (this.status) this.status.string = text;
  }

  private playPathNotes(previous: Pos[], next: Pos[]): void {
    const previousKeys = new Set(previous.map((pos) => this.key(pos)));
    const entered = next.filter((pos) => !previousKeys.has(this.key(pos)));
    entered.forEach((pos, index) => {
      this.scheduleOnce(() => this.playSlideSound(pos), index * 0.025);
    });
  }

  private playSlideSound(pos?: Pos): void {
    if (!this.soundEnabled) return;
    const pitchIndex = pos ? (pos.row * 2 + pos.col * 3) % 12 : 7;
    if (this.platform.playSlideTone(pitchIndex)) return;

    const ctx = this.getSlideAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.value = 520 + pitchIndex * 42;
      if (gain.gain.setValueAtTime) {
        gain.gain.setValueAtTime(0.052, now);
      } else {
        gain.gain.value = 0.052;
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore audio failures in restricted preview environments.
    }
  }

  private getSlideAudioContext(): SimpleAudioContext | undefined {
    if (this.slideAudioContext) {
      void this.slideAudioContext.resume?.();
      return this.slideAudioContext;
    }

    const runtime = globalThis as unknown as {
      AudioContext?: new () => SimpleAudioContext;
      webkitAudioContext?: new () => SimpleAudioContext;
    };
    const AudioCtor = runtime.AudioContext ?? runtime.webkitAudioContext;
    if (!AudioCtor) return undefined;

    try {
      this.slideAudioContext = new AudioCtor();
      void this.slideAudioContext.resume?.();
      return this.slideAudioContext;
    } catch {
      return undefined;
    }
  }
}
