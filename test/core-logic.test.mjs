import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const require = createRequire(import.meta.url);
const outDir = join(root, '.tmp/test-dist');

execFileSync(join(root, 'node_modules/.bin/tsc'), [
  '--outDir', outDir,
  '--module', 'CommonJS',
  '--moduleResolution', 'Node',
  '--target', 'ES2020',
  '--experimentalDecorators',
  '--skipLibCheck',
], { stdio: 'inherit' });

const { BoardManager } = require(join(outDir, 'manager/BoardManager.js'));
const { boardSizeFor, getLevelRepeatStats } = require(join(outDir, 'core/LevelGenerator.js'));
const { LevelManager } = require(join(outDir, 'manager/LevelManager.js'));
const { WordManager } = require(join(outDir, 'manager/WordManager.js'));
const { TouchController } = require(join(outDir, 'game/TouchController.js'));

const stats = getLevelRepeatStats();
assert.equal(stats.levels, 300);
assert.ok(
  stats.repeatRate <= 0.1,
  `level word repeat rate should be <= 10%, got ${(stats.repeatRate * 100).toFixed(2)}%`,
);

const boardSizes = new Set();
for (let levelId = 1; levelId <= 300; levelId += 1) {
  boardSizes.add(boardSizeFor(levelId));
}
assert.deepEqual([...boardSizes].sort((left, right) => left - right), [6, 7, 8, 9, 10, 11]);

const levelManager = new LevelManager();
const wordMeanings = JSON.parse(readFileSync(join(root, 'assets/resources/config/word_meanings.json'), 'utf8'));
for (let levelId = 1; levelId <= 300; levelId += 1) {
  const config = await levelManager.loadLevel(levelId);
  assert.equal(new Set(config.words).size, config.words.length, `level ${levelId} should not repeat words inside the level`);
  for (const word of config.words) {
    assert.ok(word.length <= config.boardSize, `${word} should fit level ${levelId} board`);
    assert.ok(wordMeanings[word], `${word} should have a Chinese meaning`);
  }
}

const level = await new LevelManager().loadLevel(1);
const boardManager = new BoardManager();
const board = boardManager.generateBoard(level);

assert.equal(board.size, level.boardSize);
assert.equal(board.cells.length, level.boardSize);

for (const word of level.words) {
  assert.ok(board.answers[word], `${word} should be placed`);
  assert.equal(board.answers[word].length, word.length);
  const letters = board.answers[word].map((pos) => board.cells[pos.row][pos.col]).join('');
  assert.equal(letters, word);
}

const diagonalAnswers = level.words.filter((word) => {
  const path = board.answers[word];
  return path.length > 1 && path[0].row !== path[1].row && path[0].col !== path[1].col;
});
assert.ok(diagonalAnswers.length >= 1, 'level 1 should include at least one diagonal word');

const wordManager = new WordManager();
wordManager.setup(level, board);
const firstWord = level.words[0];
const result = wordManager.checkWord(board.answers[firstWord]);
assert.equal(result.matched, true);
assert.equal(result.word, firstWord);

const touch = new TouchController();
touch.begin({ row: 0, col: 0 });
touch.move({ row: 3, col: 3 });
assert.deepEqual(touch.end(), [
  { row: 0, col: 0 },
  { row: 1, col: 1 },
  { row: 2, col: 2 },
  { row: 3, col: 3 },
]);

console.log('core logic ok');
