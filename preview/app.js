const SAVE_KEY = 'WORD_SEARCH_PREVIEW_SAVE';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WORD_BANK = [
  'CAT', 'DOG', 'SUN', 'MAP', 'SKY', 'KEY', 'BEE', 'CAR', 'BUS', 'CUP', 'HAT', 'BOX',
  'BIRD', 'FISH', 'TREE', 'MOON', 'STAR', 'RAIN', 'WIND', 'BOOK', 'GAME', 'WORD', 'HOME', 'CAKE',
  'APPLE', 'BEACH', 'LIGHT', 'SMILE', 'GREEN', 'CHAIR', 'TABLE', 'MUSIC', 'RIVER', 'STONE', 'GRASS',
  'PLANET', 'FOREST', 'PUZZLE', 'MARKET', 'GARDEN', 'ORANGE', 'POCKET', 'SUMMER', 'WINTER', 'SPRING',
  'FLOWER', 'BRIDGE', 'CASTLE', 'DRAGON', 'BUTTON', 'COFFEE', 'COOKIE', 'SILVER', 'YELLOW', 'PURPLE',
  'ANIMAL', 'FRIEND', 'ISLAND', 'JUNGLE', 'ROCKET', 'SCHOOL', 'TUNNEL', 'WINDOW', 'FAMILY', 'MONKEY',
  'ADVENTURE', 'BACKPACK', 'CALENDAR', 'DIAMOND', 'ELEPHANT', 'FESTIVAL', 'HOSPITAL', 'KEYBOARD',
  'LANGUAGE', 'MOUNTAIN', 'NOTEBOOK', 'PAINTING', 'QUESTION', 'RAINBOW', 'SANDWICH', 'TREASURE',
  'UMBRELLA', 'VACATION', 'WILDLIFE', 'SUNLIGHT', 'SEASHELL', 'BASEBALL', 'CAMPFIRE', 'AIRPLANE',
  'STARFISH', 'SNOWBALL', 'FIREFLY', 'DAYDREAM', 'LIFELONG', 'WATERMELON', 'BLACKBOARD',
  'TOOTHBRUSH', 'PLAYGROUND', 'BASKETBALL', 'SKATEBOARD', 'HELICOPTER', 'LIGHTHOUSE', 'FRIENDSHIP',
  'ADVENTURES', 'SKYSCRAPER', 'PHOTOGRAPH', 'WONDERLAND', 'DRAGONFRUIT', 'CELEBRATION', 'IMAGINATION',
];

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

startLevel(state.save.currentLevel);

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
  return (id - 1) % 12;
}

function difficultyRankFor(id) {
  const wave = [1, 2, 3, 4, 5, 4, 2, 3, 4, 5, 5, 3];
  const progressBonus = Math.floor((id - 1) / 250);
  const base = wave[wavePhaseFor(id)];
  const bonusCap = base <= 2 ? 1 : base === 3 ? 2 : base === 4 ? 1 : 0;
  return clamp(base + Math.min(progressBonus, bonusCap), 1, 5);
}

function isPeakLevel(id) {
  const phase = wavePhaseFor(id);
  return phase === 4 || phase === 10;
}

function takeWords(id, count, minLength, maxLength) {
  const pool = WORD_BANK.filter((word) => word.length >= minLength && word.length <= maxLength);
  const words = [];
  let cursor = (id * 7) % pool.length;
  let guard = 0;
  while (words.length < count && guard < pool.length * 3) {
    const word = pool[cursor % pool.length];
    if (!words.includes(word)) words.push(word);
    cursor += 5;
    guard += 1;
  }
  return words;
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
