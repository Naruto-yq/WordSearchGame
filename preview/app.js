const SAVE_KEY = 'WORD_SEARCH_PREVIEW_SAVE';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FIRST_LEVEL_WORDS = ['CAT', 'DOG', 'SUN', 'CAR'];
const ROLLER_COASTER_WAVE = [1, 2, 3, 4, 5, 4, 2, 3, 4, 5, 5, 3];
let WORD_BANK = [];
let LEVEL_WORDS_CACHE = null;
const RANGE_POOL_CACHE = new Map();

const state = {
  level: null,
  board: null,
  selectedStart: null,
  found: new Set(),
  save: loadSave(),
};

const els = {
  status: document.querySelector('#status'),
  words: document.querySelector('#words'),
  board: document.querySelector('#board'),
  coin: document.querySelector('#coin'),
  hintCount: document.querySelector('#hintCount'),
  hintButton: document.querySelector('#hintButton'),
  restartButton: document.querySelector('#restartButton'),
  nextButton: document.querySelector('#nextButton'),
};

els.hintButton.addEventListener('click', onHint);
els.restartButton.addEventListener('click', () => startLevel(state.save.currentLevel));
els.nextButton.addEventListener('click', () => startLevel(state.save.currentLevel));

init();

async function init() {
  await loadWordBank();
  startLevel(state.save.currentLevel);
}

async function loadWordBank() {
  const response = await fetch('../assets/scripts/core/WordBank.ts');
  const text = await response.text();
  WORD_BANK = [...text.matchAll(/"([A-Z]+)"/g)].map((match) => match[1]);
  LEVEL_WORDS_CACHE = null;
  RANGE_POOL_CACHE.clear();
}

async function startLevel(levelId) {
  state.level = createLevel(levelId);
  state.board = generateBoard(state.level);
  state.selectedStart = null;
  state.found = new Set();
  state.save.currentLevel = state.level.id;
  state.save.maxUnlockedLevel = Math.max(state.save.maxUnlockedLevel, state.level.id);
  save();
  render();
  setStatus(`Level ${state.level.id}  ${state.level.difficulty.toUpperCase()}：点起点，再点终点完成连线`);
}

function createLevel(levelId) {
  const id = Math.max(1, Math.min(1000, Math.floor(levelId)));
  const boardSize = boardSizeFor(id);
  const minLength = minWordLengthFor(id);
  return {
    id,
    chapter: Math.ceil(id / 20),
    difficulty: difficultyFor(id),
    boardSize,
    words: takeWords(id, wordCountFor(id), minLength, maxWordLengthFor(id, boardSize, minLength)),
    allowReverse: true,
    allowDiagonal: true,
  };
}

function boardSizeFor(id) {
  const rank = difficultyRankFor(id);
  if (rank < 5) return rank + 5;
  const phase = wavePhaseFor(id);
  return id >= 360 && (phase === 4 || phase === 10) ? 11 : 10;
}

function difficultyFor(id) {
  const rank = difficultyRankFor(id);
  return ['easy', 'normal', 'hard', 'expert', 'hell'][rank - 1] || 'easy';
}

function wordCountFor(id) {
  const rank = difficultyRankFor(id);
  const progressBonus = Math.floor((id - 1) / 260);
  const peakBonus = isPeakLevel(id) ? 1 : 0;
  const baseByRank = [0, 4, 5, 6, 7, 8][rank] ?? 8;
  return clamp(baseByRank + Math.floor(progressBonus / 2) + peakBonus, 4, rank >= 5 ? 11 : 9);
}

function minWordLengthFor(id) {
  const rank = difficultyRankFor(id);
  const progressBonus = Math.floor((id - 1) / 360);
  const baseByRank = [0, 3, 4, 4, 5, 6][rank] ?? 6;
  return clamp(baseByRank + progressBonus, 3, rank >= 5 ? 8 : 6);
}

function maxWordLengthFor(id, boardSize, minLength) {
  const rank = difficultyRankFor(id);
  if (rank <= 2) return Math.min(boardSize, minLength + 2);
  if (rank === 3) return Math.min(boardSize, minLength + 3);
  return boardSize;
}

function wavePhaseFor(id) {
  return (id - 1) % ROLLER_COASTER_WAVE.length;
}

function difficultyRankFor(id) {
  const progressBonus = Math.floor((id - 1) / 250);
  const base = ROLLER_COASTER_WAVE[wavePhaseFor(id)];
  const bonusCap = base <= 2 ? 1 : base === 3 ? 2 : base === 4 ? 1 : 0;
  return clamp(base + Math.min(progressBonus, bonusCap), 1, 5);
}

function isPeakLevel(id) {
  const phase = wavePhaseFor(id);
  return phase === 4 || phase === 10;
}

function takeWords(id, count, minLength, maxLength) {
  return getLevelWords(id, count, minLength, maxLength);
}

function getLevelWords(id) {
  if (!LEVEL_WORDS_CACHE) LEVEL_WORDS_CACHE = buildLevelWords();
  return [...LEVEL_WORDS_CACHE[id - 1]];
}

function buildLevelWords() {
  const usedWords = new Set();
  const rangeCursors = new Map();
  const levels = [];

  for (let level = 1; level <= 1000; level += 1) {
    const boardSize = boardSizeFor(level);
    const minLength = minWordLengthFor(level);
    const maxLength = maxWordLengthFor(level, boardSize, minLength);
    const count = wordCountFor(level);
    const localWords = new Set();
    const words = [];

    if (level === 1) {
      for (const word of FIRST_LEVEL_WORDS) {
        if (words.length >= count) break;
        if (canUseWord(word, minLength, maxLength, localWords)) {
          addLevelWord(words, usedWords, localWords, word);
        }
      }
    }

    while (words.length < count) {
      const word = pickWord(level, words.length, minLength, maxLength, usedWords, localWords, rangeCursors);
      if (!word) throw new Error(`Unable to pick enough words for level ${level}`);
      addLevelWord(words, usedWords, localWords, word);
    }

    levels.push(words);
  }

  return levels;
}

function addLevelWord(words, usedWords, localWords, word) {
  words.push(word);
  usedWords.add(word);
  localWords.add(word);
}

function canUseWord(word, minLength, maxLength, localWords) {
  return word.length >= minLength && word.length <= maxLength && !localWords.has(word);
}

function pickWord(level, slot, minLength, maxLength, usedWords, localWords, rangeCursors) {
  const key = `${minLength}-${maxLength}`;
  const pool = getRangePool(minLength, maxLength);
  if (pool.length === 0) return undefined;

  const startCursor = rangeCursors.has(key) ? rangeCursors.get(key) : hashString(`${key}:${level}:${slot}`) % pool.length;
  const unusedWord = scanPool(pool, startCursor, localWords, usedWords, false);
  if (unusedWord) {
    rangeCursors.set(key, (unusedWord.index + 1) % pool.length);
    return unusedWord.word;
  }

  const reusableWord = scanPool(pool, startCursor, localWords, usedWords, true);
  if (reusableWord) {
    rangeCursors.set(key, (reusableWord.index + 1) % pool.length);
    return reusableWord.word;
  }

  return undefined;
}

function scanPool(pool, startCursor, localWords, usedWords, allowPreviouslyUsed) {
  for (let offset = 0; offset < pool.length; offset += 1) {
    const index = (startCursor + offset) % pool.length;
    const word = pool[index];
    if (localWords.has(word)) continue;
    if (!allowPreviouslyUsed && usedWords.has(word)) continue;
    return { word, index };
  }
  return undefined;
}

function getRangePool(minLength, maxLength) {
  const key = `${minLength}-${maxLength}`;
  if (RANGE_POOL_CACHE.has(key)) return RANGE_POOL_CACHE.get(key);

  const pool = WORD_BANK
    .filter((word) => word.length >= minLength && word.length <= maxLength)
    .sort((left, right) => {
      const score = hashString(`${key}:${left}`) - hashString(`${key}:${right}`);
      return score === 0 ? left.localeCompare(right) : score;
    });

  RANGE_POOL_CACHE.set(key, pool);
  return pool;
}

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function generateBoard(level) {
  const size = level.boardSize;
  const cells = Array.from({ length: size }, () => Array.from({ length: size }, () => ''));
  const answers = {};
  const words = [...level.words].sort((a, b) => b.length - a.length);
  const dirs = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 150 && !placed; attempt += 1) {
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      const path = Array.from({ length: word.length }, (_, index) => ({
        row: row + dr * index,
        col: col + dc * index,
      }));
      if (!path.every((p) => p.row >= 0 && p.row < size && p.col >= 0 && p.col < size)) continue;
      if (!path.every((p, index) => cells[p.row][p.col] === '' || cells[p.row][p.col] === word[index])) continue;
      path.forEach((p, index) => {
        cells[p.row][p.col] = word[index];
      });
      answers[word] = path;
      placed = true;
    }
    if (!placed) throw new Error(`Cannot place ${word}`);
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!cells[row][col]) cells[row][col] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
  }

  return { size, cells, answers };
}

function render() {
  els.coin.textContent = state.save.coin;
  els.hintCount.textContent = state.save.hintCount;
  renderWords();
  renderBoard();
}

function renderWords() {
  els.words.innerHTML = '';
  for (const word of state.level.words) {
    const chip = document.createElement('span');
    chip.className = `word${state.found.has(word) ? ' done' : ''}`;
    chip.textContent = word;
    els.words.append(chip);
  }
}

function renderBoard() {
  els.board.innerHTML = '';
  els.board.style.gridTemplateColumns = `repeat(${state.board.size}, 1fr)`;
  const foundCells = new Set([...state.found].flatMap((word) => state.board.answers[word].map(cellKey)));
  for (let row = 0; row < state.board.size; row += 1) {
    for (let col = 0; col < state.board.size; col += 1) {
      const cell = document.createElement('button');
      cell.className = `cell${foundCells.has(cellKey({ row, col })) ? ' found' : ''}`;
      cell.textContent = state.board.cells[row][col];
      cell.style.fontSize = `${Math.max(16, Math.floor(130 / state.board.size))}px`;
      cell.addEventListener('click', () => onCell({ row, col }));
      els.board.append(cell);
    }
  }
}

function onCell(pos) {
  if (!state.selectedStart) {
    state.selectedStart = pos;
    markSelection([pos]);
    setStatus(`起点：第 ${pos.row + 1} 行第 ${pos.col + 1} 列`);
    return;
  }

  const path = buildPath(state.selectedStart, pos);
  state.selectedStart = null;
  if (!path.length) {
    setStatus('只能选择横向、纵向或斜向连续字母');
    renderBoard();
    return;
  }

  const selected = path.map((p) => state.board.cells[p.row][p.col]).join('');
  const reversed = selected.split('').reverse().join('');
  const match = state.level.words.find((word) => !state.found.has(word) && (word === selected || word === reversed));
  if (!match) {
    setStatus(`未命中：${selected}`);
    renderBoard();
    return;
  }

  state.found.add(match);
  if (state.found.size === state.level.words.length) {
    completeLevel();
  } else {
    setStatus(`找到 ${match}，继续`);
  }
  render();
}

function buildPath(start, end) {
  const dr = Math.sign(end.row - start.row);
  const dc = Math.sign(end.col - start.col);
  const rowDistance = Math.abs(end.row - start.row);
  const colDistance = Math.abs(end.col - start.col);
  if (!(rowDistance === 0 || colDistance === 0 || rowDistance === colDistance)) return [];
  const length = Math.max(rowDistance, colDistance);
  return Array.from({ length: length + 1 }, (_, index) => ({
    row: start.row + dr * index,
    col: start.col + dc * index,
  }));
}

function markSelection(path) {
  renderBoard();
  const keys = new Set(path.map(cellKey));
  document.querySelectorAll('.cell').forEach((cell, index) => {
    const row = Math.floor(index / state.board.size);
    const col = index % state.board.size;
    if (keys.has(cellKey({ row, col }))) cell.classList.add('selected');
  });
}

function onHint() {
  const word = state.level.words.find((item) => !state.found.has(item));
  if (!word) return;
  if (state.save.hintCount <= 0) {
    setStatus('提示次数不足；正式小游戏里这里会接激励视频');
    return;
  }
  state.save.hintCount -= 1;
  save();
  const pos = state.board.answers[word][0];
  setStatus(`提示：${word} 从第 ${pos.row + 1} 行第 ${pos.col + 1} 列开始`);
  markSelection([pos]);
  renderWords();
  els.hintCount.textContent = state.save.hintCount;
}

function completeLevel() {
  state.save.coin += 60;
  state.save.completedLevels = [...new Set([...state.save.completedLevels, state.level.id])];
  state.save.currentLevel = Math.min(1000, state.level.id + 1);
  state.save.maxUnlockedLevel = Math.max(state.save.maxUnlockedLevel, state.save.currentLevel);
  save();
  setStatus(`通关！获得金币 +60，下一关 Level ${state.save.currentLevel}`);
}

function setStatus(text) {
  els.status.textContent = text;
}

function cellKey(pos) {
  return `${pos.row}:${pos.col}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadSave() {
  try {
    return {
      currentLevel: 1,
      maxUnlockedLevel: 1,
      completedLevels: [],
      hintCount: 3,
      coin: 0,
      ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'),
    };
  } catch {
    return { currentLevel: 1, maxUnlockedLevel: 1, completedLevels: [], hintCount: 3, coin: 0 };
  }
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
}
