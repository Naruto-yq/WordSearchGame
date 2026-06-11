import { BASE_REWARD_COIN, EVENT, MAX_LEVEL } from '../core/GameConst';
import { EventCenter } from '../core/EventCenter';
import { CellPos, HintResult, LevelClearResult, LevelRuntime } from '../core/GameTypes';
import { IPlatform } from '../platform/IPlatform';
import { PlatformFactory } from '../platform/PlatformFactory';
import { RandomUtil } from '../utils/RandomUtil';
import { AdManager } from './AdManager';
import { AudioManager } from './AudioManager';
import { BoardManager } from './BoardManager';
import { LevelManager } from './LevelManager';
import { StorageManager } from './StorageManager';
import { WordManager } from './WordManager';

export class GameManager {
  static readonly instance = new GameManager();

  readonly levelManager = new LevelManager();
  readonly boardManager = new BoardManager();
  readonly wordManager = new WordManager();

  private platform: IPlatform = PlatformFactory.create();
  private adManager = new AdManager(this.platform);
  private runtime?: LevelRuntime;
  private paused = false;

  init(platform = PlatformFactory.create(), adManager?: AdManager): void {
    this.platform = platform;
    this.adManager = adManager ?? new AdManager(platform);
    this.platform.init();
    StorageManager.setup(platform);
    StorageManager.load();
  }

  async startLevel(levelId: number): Promise<LevelRuntime> {
    const config = await this.levelManager.loadLevel(levelId);
    const board = this.boardManager.generateBoard(config);
    this.wordManager.setup(config, board);
    this.paused = false;
    this.runtime = {
      config,
      board,
      foundWords: [],
      startedAt: Date.now(),
    };

    StorageManager.update((data) => {
      data.currentLevel = config.id;
      data.maxUnlockedLevel = Math.max(data.maxUnlockedLevel, config.id);
    });

    EventCenter.emit(EVENT.LEVEL_STARTED, this.runtime);
    return this.runtime;
  }

  async restartLevel(): Promise<LevelRuntime> {
    return this.startLevel(this.runtime?.config.id ?? StorageManager.load().currentLevel);
  }

  submitPath(path: CellPos[]): LevelClearResult | undefined {
    if (this.paused || !this.runtime) {
      return undefined;
    }

    const result = this.wordManager.checkWord(path);
    if (!result.matched || !result.word) {
      AudioManager.playSound('wrong');
      return undefined;
    }

    AudioManager.playSound('correct');
    if (StorageManager.load().vibrateEnabled) {
      this.platform.vibrateShort();
    }

    this.runtime.foundWords = this.wordManager.getFoundWords();
    EventCenter.emit(EVENT.WORD_FOUND, result);

    if (this.wordManager.isAllWordsFound()) {
      return this.completeLevel();
    }

    return undefined;
  }

  completeLevel(): LevelClearResult {
    if (!this.runtime) {
      throw new Error('No active level to complete.');
    }

    const usedSeconds = Math.max(1, Math.floor((Date.now() - this.runtime.startedAt) / 1000));
    const stars = this.calculateStars(usedSeconds, this.runtime.config.boardSize);
    const coin = BASE_REWARD_COIN * stars;
    const levelId = this.runtime.config.id;
    const nextLevel = Math.min(levelId + 1, MAX_LEVEL);

    StorageManager.update((data) => {
      data.currentLevel = nextLevel;
      data.maxUnlockedLevel = Math.max(data.maxUnlockedLevel, nextLevel);
      data.coin += coin;
      if (!data.completedLevels.includes(levelId)) {
        data.completedLevels.push(levelId);
      }
    });

    AudioManager.playSound('clear');
    const clearResult = { levelId, usedSeconds, stars, coin, nextLevel };
    EventCenter.emit(EVENT.LEVEL_COMPLETED, clearResult);
    return clearResult;
  }

  pauseGame(): void {
    this.paused = true;
  }

  resumeGame(): void {
    this.paused = false;
  }

  async useHint(): Promise<HintResult> {
    if (!this.runtime) {
      return { ok: false };
    }

    let save = StorageManager.load();
    if (save.hintCount <= 0) {
      const watched = await this.adManager.showRewardAd('hint');
      if (!watched) {
        return { ok: false, needAd: true };
      }

      save = StorageManager.update((data) => {
        data.hintCount += 1;
      });
    }

    const unfound = this.wordManager.getUnfoundWords();
    if (unfound.length === 0) {
      return { ok: false };
    }

    const word = RandomUtil.pick(unfound);
    const pos = this.runtime.board.answers[word]?.[0];
    StorageManager.update((data) => {
      data.hintCount = Math.max(0, save.hintCount - 1);
    });

    return { ok: Boolean(pos), word, pos };
  }

  getRuntime(): LevelRuntime | undefined {
    return this.runtime;
  }

  private calculateStars(usedSeconds: number, boardSize: number): number {
    const threeStarLimit = boardSize * 18;
    const twoStarLimit = boardSize * 30;
    if (usedSeconds <= threeStarLimit) {
      return 3;
    }
    if (usedSeconds <= twoStarLimit) {
      return 2;
    }
    return 1;
  }
}
