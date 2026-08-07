import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderGame } from '../../js/games/order.js';
import { makeFakeDocument } from '../helpers/fake-dom.js';

const CONFIG = {
  type: 'order',
  prompt: 'Собери пищевую цепь',
  sequence: ['Пшеница', 'Полёвка', 'Лисица', 'Орёл'],
  explanation: 'Цепь начинается с растения.',
};

const опции = () => ({ document: makeFakeDocument(), random: () => 0 });

test('игра знает длину цепочки', () => {
  const game = createOrderGame(CONFIG, опции());
  assert.equal(game.getResult().total, 4);
});

test('верный порядок даёт полный результат', () => {
  const game = createOrderGame(CONFIG, опции());
  for (const t of ['Пшеница', 'Полёвка', 'Лисица', 'Орёл']) game.pick(t);
  const r = game.getResult();
  assert.equal(r.correct, 4);
  assert.ok(game.isComplete());
});

test('элемент, поставленный не на своё место, засчитывается неверным', () => {
  const game = createOrderGame(CONFIG, опции());
  for (const t of ['Полёвка', 'Пшеница', 'Лисица', 'Орёл']) game.pick(t);
  const r = game.getResult();
  assert.equal(r.correct, 2);
  const d = r.details.find((x) => x.id === 'Полёвка');
  assert.equal(d.ok, false);
  assert.equal(d.expected, 1);
  assert.equal(d.got, 0);
});

test('повторный тап по уже поставленному элементу ничего не ломает', () => {
  const game = createOrderGame(CONFIG, опции());
  game.pick('Пшеница');
  game.pick('Пшеница');
  assert.equal(game.getPicked().length, 1);
});

test('последний элемент можно снять', () => {
  const game = createOrderGame(CONFIG, опции());
  game.pick('Пшеница');
  game.pick('Полёвка');
  game.undo();
  assert.deepEqual(game.getPicked(), ['Пшеница']);
});

test('reset очищает цепочку', () => {
  const game = createOrderGame(CONFIG, опции());
  game.pick('Пшеница');
  game.reset();
  assert.deepEqual(game.getPicked(), []);
  assert.equal(game.getResult().correct, 0);
});

test('цепочка короче двух элементов отвергается', () => {
  assert.throws(
    () => createOrderGame({ type: 'order', sequence: ['Одно'] }, опции()),
    /Игре «order» нужна цепочка хотя бы из двух элементов/,
  );
});
