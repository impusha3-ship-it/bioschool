import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSortGame } from '../../js/games/sort.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const CONFIG = {
  type: 'sort',
  prompt: 'Разложи на живое и неживое',
  buckets: [
    { id: 'alive', title: 'Живое' },
    { id: 'not', title: 'Неживое' },
  ],
  items: [
    { id: 'hare', text: 'Заяц', bucket: 'alive' },
    { id: 'crystal', text: 'Кристалл соли', bucket: 'not' },
    { id: 'fire', text: 'Огонь', bucket: 'not' },
  ],
};

test('игра строит элемент и знает общее число заданий', () => {
  const game = createSortGame(CONFIG, { document: makeFakeDocument(), random: () => 0 });
  assert.ok(game.element);
  assert.equal(game.getResult().total, 3);
  assert.equal(game.getResult().correct, 0);
});

test('верная раскладка даёт полный результат', () => {
  const game = createSortGame(CONFIG, { document: makeFakeDocument(), random: () => 0 });
  game.selectItem('hare');
  game.placeInBucket('alive');
  game.selectItem('crystal');
  game.placeInBucket('not');
  game.selectItem('fire');
  game.placeInBucket('not');

  const r = game.getResult();
  assert.equal(r.correct, 3);
  assert.equal(r.total, 3);
  assert.ok(game.isComplete());
});

test('ошибка засчитывается и видна в разборе', () => {
  const game = createSortGame(CONFIG, { document: makeFakeDocument(), random: () => 0 });
  game.selectItem('fire');
  game.placeInBucket('alive');

  const деталь = game.getResult().details.find((d) => d.id === 'fire');
  assert.equal(деталь.ok, false);
  assert.equal(деталь.expected, 'not');
  assert.equal(деталь.got, 'alive');
});

test('элемент можно переложить, пока игра не завершена', () => {
  const game = createSortGame(CONFIG, { document: makeFakeDocument(), random: () => 0 });
  game.selectItem('fire');
  game.placeInBucket('alive');
  game.selectItem('fire');
  game.placeInBucket('not');
  assert.equal(game.getResult().details.find((d) => d.id === 'fire').ok, true);
});

test('reset очищает раскладку', () => {
  const game = createSortGame(CONFIG, { document: makeFakeDocument(), random: () => 0 });
  game.selectItem('hare');
  game.placeInBucket('alive');
  game.reset();
  assert.equal(game.getResult().correct, 0);
  assert.equal(game.isComplete(), false);
});

test('конфиг без корзин отвергается с понятной ошибкой', () => {
  assert.throws(
    () => createSortGame({ type: 'sort', buckets: [], items: [] }, { document: makeFakeDocument() }),
    /Игре «sort» нужны корзины и объекты/,
  );
});

test('объект, ссылающийся на несуществующую корзину, отвергается', () => {
  assert.throws(
    () => createSortGame({
      type: 'sort',
      buckets: [{ id: 'alive', title: 'Живое' }],
      items: [{ id: 'x', text: 'Икс', bucket: 'выдумка' }],
    }, { document: makeFakeDocument() }),
    /Объект «x» отправлен в несуществующую корзину «выдумка»/,
  );
});
