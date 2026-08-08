import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeShort,
  checkAnswer,
  scoreQuestions,
  openQuestions,
  combineScore,
  grade,
  isAuto,
} from '../../js/homework/questions.js';

// ── Мягкое сравнение коротких ответов ────────────────────────

test('регистр, пробелы и «ё» не влияют на правильность', () => {
  const эталон = normalizeShort('клетка');
  for (const вариант of ['Клетка', 'КЛЕТКА', '  клетка  ', 'клетка.', 'клётка']) {
    assert.equal(normalizeShort(вариант), эталон, вариант);
  }
});

test('внутренние лишние пробелы схлопываются', () => {
  assert.equal(normalizeShort('обмен   веществ'), 'обмен веществ');
});

test('дефис сохраняется — он бывает частью термина', () => {
  assert.equal(normalizeShort('Наземно-воздушная'), 'наземно-воздушная');
});

test('пустой ответ нормализуется в пустую строку', () => {
  for (const пусто of ['', '   ', null, undefined]) assert.equal(normalizeShort(пусто), '');
});

// ── Один верный ответ ────────────────────────────────────────

const выбор = { id: 'q1', type: 'choice', text: 'Что?', options: ['А', 'Б', 'В'], correct: 1 };

test('верный выбор засчитывается', () => {
  assert.equal(checkAnswer(выбор, 1).ok, true);
});

test('неверный выбор не засчитывается', () => {
  assert.equal(checkAnswer(выбор, 0).ok, false);
});

test('пропущенный вопрос считается неверным, а не пропадает', () => {
  const r = checkAnswer(выбор, undefined);
  assert.equal(r.ok, false);
  assert.equal(r.got, null);
});

// Нулевой вариант — классическая ловушка: 0 ложно, и наивная проверка его теряет.
test('нулевой вариант ответа не теряется', () => {
  const q = { id: 'q0', type: 'choice', options: ['А', 'Б'], correct: 0 };
  assert.equal(checkAnswer(q, 0).ok, true);
  assert.equal(checkAnswer(q, 1).ok, false);
});

// ── Несколько верных ─────────────────────────────────────────

const много = { id: 'q2', type: 'multi', options: ['А', 'Б', 'В', 'Г'], correct: [0, 2] };

test('полное совпадение засчитывается независимо от порядка', () => {
  assert.equal(checkAnswer(много, [2, 0]).ok, true);
});

// Иначе выгодно отметить всё подряд и получить балл за перебор.
test('частично верный ответ не засчитывается', () => {
  assert.equal(checkAnswer(много, [0]).ok, false);
  assert.equal(checkAnswer(много, [0, 2, 3]).ok, false);
});

test('повторы в ответе не превращают его в неверный', () => {
  assert.equal(checkAnswer(много, [0, 2, 2, 0]).ok, true);
});

test('пустой ответ на вопрос с несколькими верными — неверный', () => {
  assert.equal(checkAnswer(много, []).ok, false);
  assert.equal(checkAnswer(много, undefined).ok, false);
});

// ── Короткий ответ ───────────────────────────────────────────

const короткий = { id: 'q3', type: 'short', answers: ['клетка', 'клетки'] };

test('любой из принимаемых вариантов засчитывается', () => {
  assert.equal(checkAnswer(короткий, 'Клетки').ok, true);
  assert.equal(checkAnswer(короткий, 'клетка').ok, true);
});

test('чужое слово не засчитывается', () => {
  assert.equal(checkAnswer(короткий, 'ткань').ok, false);
});

test('пустой короткий ответ не засчитывается', () => {
  assert.equal(checkAnswer(короткий, '   ').ok, false);
});

test('исходный ответ ученика сохраняется как есть — учителю его читать', () => {
  assert.equal(checkAnswer(короткий, '  Клётки  ').got, 'Клётки');
});

// ── Развёрнутые ──────────────────────────────────────────────

test('развёрнутый вопрос автоматически не проверяется', () => {
  const q = { id: 'q4', type: 'open', prompt: 'Объясни' };
  assert.equal(isAuto(q), false);
  assert.equal(checkAnswer(q, 'длинный текст'), null);
});

test('развёрнутые вопросы отбираются отдельно', () => {
  const список = [выбор, { id: 'o1', type: 'open' }, короткий, { id: 'o2', type: 'open' }];
  assert.deepEqual(openQuestions(список).map((q) => q.id), ['o1', 'o2']);
});

// ── Подсчёт ──────────────────────────────────────────────────

test('считаются только автопроверяемые вопросы', () => {
  const вопросы = [выбор, много, короткий, { id: 'o1', type: 'open' }];
  const r = scoreQuestions(вопросы, { q1: 1, q2: [0, 2], q3: 'клетка', o1: 'что-то' });
  assert.equal(r.total, 3, 'развёрнутый в общее число не входит');
  assert.equal(r.correct, 3);
});

test('неотвеченная работа даёт ноль, а не падение', () => {
  const r = scoreQuestions([выбор, много, короткий], {});
  assert.equal(r.total, 3);
  assert.equal(r.correct, 0);
});

test('пустой список вопросов не ломает подсчёт', () => {
  assert.deepEqual(scoreQuestions(), { total: 0, correct: 0, details: [] });
});

test('итог складывает игру и вопросы', () => {
  const r = combineScore({ game: { correct: 7, total: 8 }, questions: { correct: 4, total: 6 } });
  assert.deepEqual(r, { correct: 11, total: 14, percent: 79 });
});

test('итог без игры считается только по вопросам', () => {
  assert.deepEqual(combineScore({ questions: { correct: 3, total: 4 } }), { correct: 3, total: 4, percent: 75 });
});

// Деление на ноль случается на уроке, где ещё нет ни игры, ни вопросов.
test('пустая работа не делит на ноль', () => {
  assert.deepEqual(combineScore({}), { correct: 0, total: 0, percent: 0 });
});

test('отметка выставляется по порогам', () => {
  assert.equal(grade(100), 5);
  assert.equal(grade(85), 5);
  assert.equal(grade(84), 4);
  assert.equal(grade(70), 4);
  assert.equal(grade(69), 3);
  assert.equal(grade(50), 3);
  assert.equal(grade(49), 2);
  assert.equal(grade(0), 2);
});

test('пороги можно задать свои', () => {
  assert.equal(grade(80, { five: 80, four: 60, three: 40 }), 5);
});
