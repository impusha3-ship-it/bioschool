import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatchGame } from '../../js/games/match.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const CONFIG = {
  type: 'match',
  prompt: 'Соедини термин с определением',
  pairs: [
    { id: 'nucleus', left: 'Ядро', right: 'Хранит наследственную информацию' },
    { id: 'chloroplast', left: 'Хлоропласт', right: 'Осуществляет фотосинтез' },
    { id: 'wall', left: 'Клеточная стенка', right: 'Придаёт клетке форму' },
  ],
};

const опции = () => ({ document: makeFakeDocument(), random: () => 0 });

test('игра знает число пар', () => {
  const game = createMatchGame(CONFIG, опции());
  assert.equal(game.getResult().total, 3);
});

test('верное соединение засчитывается', () => {
  const game = createMatchGame(CONFIG, опции());
  game.selectLeft('nucleus');
  game.selectRight('nucleus');
  assert.equal(game.getResult().correct, 1);
});

test('неверное соединение видно в разборе', () => {
  const game = createMatchGame(CONFIG, опции());
  game.selectLeft('nucleus');
  game.selectRight('chloroplast');
  const d = game.getResult().details.find((x) => x.id === 'nucleus');
  assert.equal(d.ok, false);
  assert.equal(d.expected, 'nucleus');
  assert.equal(d.got, 'chloroplast');
});

test('все пары верно — игра завершена', () => {
  const game = createMatchGame(CONFIG, опции());
  for (const id of ['nucleus', 'chloroplast', 'wall']) {
    game.selectLeft(id);
    game.selectRight(id);
  }
  assert.equal(game.getResult().correct, 3);
  assert.ok(game.isComplete());
});

test('соединение можно переделать', () => {
  const game = createMatchGame(CONFIG, опции());
  game.selectLeft('nucleus');
  game.selectRight('wall');
  game.selectLeft('nucleus');
  game.selectRight('nucleus');
  assert.equal(game.getResult().details.find((x) => x.id === 'nucleus').ok, true);
});

test('конфиг без пар отвергается', () => {
  assert.throws(
    () => createMatchGame({ type: 'match', pairs: [] }, опции()),
    /Игре «match» нужны пары/,
  );
});
