import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlacementState } from '../../js/games/engine.js';

function состояние() {
  return createPlacementState({
    items: [
      { id: 'pike', target: 'water' },
      { id: 'eagle', target: 'air' },
      { id: 'mole', target: 'soil' },
    ],
  });
}

test('в начале ничего не выбрано и ничего не размещено', () => {
  const s = состояние();
  assert.equal(s.getSelected(), null);
  assert.deepEqual(s.getPlacements(), {});
  assert.equal(s.isComplete(), false);
});

test('выбор источника запоминается', () => {
  const s = состояние();
  s.select('pike');
  assert.equal(s.getSelected(), 'pike');
});

test('повторный тап по выбранному снимает выбор', () => {
  const s = состояние();
  s.select('pike');
  s.select('pike');
  assert.equal(s.getSelected(), null);
});

test('выбор другого источника переносит выбор', () => {
  const s = состояние();
  s.select('pike');
  s.select('eagle');
  assert.equal(s.getSelected(), 'eagle');
});

test('размещение без выбранного источника ничего не делает', () => {
  const s = состояние();
  assert.equal(s.place('water'), false);
  assert.deepEqual(s.getPlacements(), {});
});

test('размещение переносит выбранный элемент и снимает выбор', () => {
  const s = состояние();
  s.select('pike');
  assert.equal(s.place('water'), true);
  assert.deepEqual(s.getPlacements(), { pike: 'water' });
  assert.equal(s.getSelected(), null);
});

test('элемент можно переложить в другую корзину', () => {
  const s = состояние();
  s.select('pike');
  s.place('air');
  s.select('pike');
  s.place('water');
  assert.deepEqual(s.getPlacements(), { pike: 'water' });
});

test('игра завершена, когда размещены все элементы', () => {
  const s = состояние();
  for (const [id, target] of [['pike', 'water'], ['eagle', 'air'], ['mole', 'soil']]) {
    s.select(id);
    s.place(target);
  }
  assert.equal(s.isComplete(), true);
});

test('подсчёт различает верные и неверные размещения', () => {
  const s = состояние();
  s.select('pike'); s.place('water');   // верно
  s.select('eagle'); s.place('soil');   // неверно
  s.select('mole'); s.place('soil');    // верно

  const r = s.getResult();
  assert.equal(r.total, 3);
  assert.equal(r.correct, 2);
  assert.deepEqual(
    r.details.find((d) => d.id === 'eagle'),
    { id: 'eagle', ok: false, expected: 'air', got: 'soil' },
  );
});

test('неразмещённый элемент считается неверным, а не пропускается', () => {
  const s = состояние();
  s.select('pike'); s.place('water');
  const r = s.getResult();
  assert.equal(r.total, 3);
  assert.equal(r.correct, 1);
  assert.equal(r.details.find((d) => d.id === 'mole').got, null);
});

test('reset возвращает игру в исходное состояние', () => {
  const s = состояние();
  s.select('pike'); s.place('water');
  s.reset();
  assert.deepEqual(s.getPlacements(), {});
  assert.equal(s.getSelected(), null);
  assert.equal(s.getResult().correct, 0);
});

test('onChange вызывается на выбор и на размещение', () => {
  const s = состояние();
  let вызовов = 0;
  s.onChange(() => { вызовов += 1; });
  s.select('pike');
  s.place('water');
  assert.equal(вызовов, 2);
});

test('неизвестный источник не выбирается', () => {
  const s = состояние();
  assert.equal(s.select('выдумка'), false);
  assert.equal(s.getSelected(), null);
});

test('placeFor размещает элемент без опоры на выбор', () => {
  const s = состояние();
  assert.equal(s.placeFor('pike', 'water'), true);
  assert.deepEqual(s.getPlacements(), { pike: 'water' });
  assert.equal(s.getSelected(), null);
});

test('placeFor снимает выбор, если размещал именно выбранный элемент', () => {
  const s = состояние();
  s.select('pike');
  s.placeFor('pike', 'water');
  assert.equal(s.getSelected(), null);
});

test('placeFor не трогает чужой выбор', () => {
  const s = состояние();
  s.select('eagle');
  s.placeFor('pike', 'water');
  assert.equal(s.getSelected(), 'eagle');
});

test('placeFor отвергает неизвестный элемент', () => {
  const s = состояние();
  assert.equal(s.placeFor('выдумка', 'water'), false);
  assert.deepEqual(s.getPlacements(), {});
});
