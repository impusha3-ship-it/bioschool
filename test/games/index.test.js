import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, KNOWN_GAME_TYPES } from '../../js/games/index.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const опции = () => ({ document: makeFakeDocument(), random: () => 0 });

test('реестр знает четыре механики', () => {
  assert.deepEqual([...KNOWN_GAME_TYPES].sort(), ['label', 'match', 'order', 'sort']);
});

test('создаёт игру нужного типа', () => {
  const game = createGame({
    type: 'sort',
    buckets: [{ id: 'a', title: 'А' }],
    items: [{ id: 'x', text: 'Икс', bucket: 'a' }],
  }, опции());
  assert.equal(game.getResult().total, 1);
});

test('неизвестный тип даёт понятную ошибку', () => {
  assert.throws(
    () => createGame({ type: 'выдумка' }, опции()),
    /Неизвестный тип игры: выдумка/,
  );
});

test('отсутствие типа даёт понятную ошибку', () => {
  assert.throws(() => createGame({}, опции()), /Неизвестный тип игры/);
});
