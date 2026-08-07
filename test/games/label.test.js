import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLabelGame } from '../../js/games/label.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const CONFIG = {
  type: 'label',
  prompt: 'Подпиши части клетки',
  image: 'kletka.svg',
  targets: [
    { id: 'wall', x: 21, y: 34, label: 'Клеточная стенка' },
    { id: 'nucleus', x: 50, y: 55, label: 'Ядро' },
  ],
  distractors: ['Жгутик'],
};

const опции = () => ({ document: makeFakeDocument(), random: () => 0 });

test('считаются только настоящие подписи, лишние в счёт не идут', () => {
  const game = createLabelGame(CONFIG, опции());
  assert.equal(game.getResult().total, 2);
});

test('верная подпись на верной точке засчитывается', () => {
  const game = createLabelGame(CONFIG, опции());
  game.selectLabel('wall');
  game.placeOnTarget('wall');
  assert.equal(game.getResult().correct, 1);
});

test('подпись на чужой точке засчитывается неверной', () => {
  const game = createLabelGame(CONFIG, опции());
  game.selectLabel('wall');
  game.placeOnTarget('nucleus');
  const d = game.getResult().details.find((x) => x.id === 'wall');
  assert.equal(d.ok, false);
  assert.equal(d.got, 'nucleus');
});

test('лишняя подпись выбирается, но никуда не подходит', () => {
  const game = createLabelGame(CONFIG, опции());
  assert.equal(game.selectLabel('distractor-0'), true);
  game.placeOnTarget('wall');
  // Настоящая подпись «wall» так и осталась неразмещённой
  assert.equal(game.getResult().details.find((x) => x.id === 'wall').got, null);
  assert.equal(game.getResult().correct, 0);
});

test('игра завершена, когда размещены все настоящие подписи', () => {
  const game = createLabelGame(CONFIG, опции());
  game.selectLabel('wall');
  game.placeOnTarget('wall');
  game.selectLabel('nucleus');
  game.placeOnTarget('nucleus');
  assert.ok(game.isComplete());
  assert.equal(game.getResult().correct, 2);
});

test('конфиг без точек отвергается', () => {
  assert.throws(
    () => createLabelGame({ type: 'label', image: 'x.svg', targets: [] }, опции()),
    /Игре «label» нужны точки на схеме/,
  );
});

test('конфиг без картинки отвергается', () => {
  assert.throws(
    () => createLabelGame({ type: 'label', targets: [{ id: 'a', x: 1, y: 1, label: 'А' }] }, опции()),
    /Игре «label» нужна схема/,
  );
});
