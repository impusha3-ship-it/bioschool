import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { makeFakeDocument } from './helpers/fake-dom.js';
import { createGame } from '../js/games/index.js';
import { scoreQuestions } from '../js/homework/questions.js';

/*
  Планка урока, заданная учителем 9 августа 2026: конспект, схема, игра и
  домашка. Урок считается готовым, только когда его можно задать классу на
  дом. Здесь это проверяется автоматически, чтобы planка держалась сама и на
  будущих уроках, а не только на тех, что писались с ней в голове.
*/

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function readJson(...parts) {
  return JSON.parse(await readFile(join(ROOT, ...parts), 'utf8'));
}

/** Уроки, на которые ссылается курс, — то есть те, что учитель может задать. */
async function заданныеУроки() {
  const dir = join(ROOT, 'content', 'courses');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const ids = [];
  for (const file of files) {
    const course = await readJson('content', 'courses', file);
    for (const section of course.sections) {
      for (const entry of section.lessons) ids.push(entry.id);
    }
  }
  return ids;
}

test('у каждого урока курса есть схема, игра и домашка', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);

    assert.ok(
      lesson.summary.blocks.some((b) => b.type === 'figure'),
      `${id}: нет схемы`,
    );
    assert.ok(lesson.game, `${id}: нет игры`);
    assert.ok(lesson.homework?.questions?.length, `${id}: нет вопросов домашки`);
    assert.ok(lesson.homework?.open?.length, `${id}: нет развёрнутого ответа`);
    assert.ok(
      lesson.homework.questions.some((q) => q.exam === 'ВПР'),
      `${id}: нет ни одного задания в формате ВПР`,
    );
    assert.ok(lesson.materials?.length, `${id}: нет материалов`);
  }
});

test('игры всех уроков собираются без ошибок', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const configs = Array.isArray(lesson.game) ? lesson.game : [lesson.game];
    for (const config of configs) {
      assert.doesNotThrow(
        () => createGame(config, { document: makeFakeDocument() }),
        `${id}: игра «${config.type}» не собралась`,
      );
    }
  }
});

/*
  Короткие ответы прогоняются через тот же движок, которым считается оценка.
  Смысл в том, что ответ проходит приведение к сравнимому виду: если в него
  затесались лишние знаки, регистр или «ё», проверка это покажет здесь, а не
  оценкой в журнале.

  Для вопросов с выбором варианта такая проверка бессмысленна: подставив
  заявленный номер и сверив с ним же, получишь совпадение всегда. Правильность
  выбора остаётся за человеком; автоматически проверяется только то, что номер
  существует и что варианты различимы.
*/
test('каждый годный ответ на короткий вопрос засчитывается движком', async () => {
  let проверено = 0;
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    for (const q of lesson.homework.questions.filter((x) => x.type === 'short')) {
      for (const ответ of q.answers) {
        const { correct } = scoreQuestions([q], { [q.id]: ответ });
        assert.equal(correct, 1, `${id}/${q.id}: ответ «${ответ}» заявлен годным, но не засчитан`);
        проверено += 1;
      }
    }
  }
  assert.ok(проверено > 0, 'коротких вопросов не нашлось — проверка ничего не проверила');
});

test('пустой и заведомо неверный ответ не засчитываются', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    for (const q of lesson.homework.questions) {
      const пусто = scoreQuestions([q], {});
      assert.equal(пусто.correct, 0, `${id}/${q.id}: пустой ответ засчитан как верный`);

      if (q.type === 'short') {
        const мимо = scoreQuestions([q], { [q.id]: 'заведомо неверный ответ' });
        assert.equal(мимо.correct, 0, `${id}/${q.id}: засчитан любой текст`);
      }
    }
  }
});

/*
  Два одинаковых варианта делают вопрос нерешаемым: ученик выбирает верный
  по смыслу, а попадает в номер, который не отмечен верным.
*/
test('варианты ответа различимы между собой', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    for (const q of lesson.homework.questions.filter((x) => x.options)) {
      assert.ok(q.options.length >= 2, `${id}/${q.id}: меньше двух вариантов`);
      const набор = new Set(q.options.map((o) => o.trim().toLowerCase()));
      assert.equal(набор.size, q.options.length, `${id}/${q.id}: варианты повторяются`);
      for (const o of q.options) assert.ok(o.trim(), `${id}/${q.id}: пустой вариант`);
    }
  }
});

test('варианты ответов не выходят за пределы списка', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    for (const q of lesson.homework.questions) {
      if (q.type === 'choice') {
        assert.ok(
          Number.isInteger(q.correct) && q.options[q.correct] !== undefined,
          `${id}/${q.id}: номер верного варианта вне списка`,
        );
      }
      if (q.type === 'multi') {
        assert.ok(q.correct.length > 0, `${id}/${q.id}: не отмечен ни один верный вариант`);
        for (const i of q.correct) {
          assert.ok(q.options[i] !== undefined, `${id}/${q.id}: номер ${i} вне списка`);
        }
      }
      if (q.type === 'short') {
        assert.ok(q.answers?.length, `${id}/${q.id}: не задано ни одного годного ответа`);
      }
    }
  }
});

test('у развёрнутых ответов есть подсказка и цена в баллах', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    for (const o of lesson.homework.open) {
      assert.ok(o.prompt, `${id}/${o.id}: нет задания`);
      assert.ok(o.hint, `${id}/${o.id}: нет подсказки`);
      assert.ok(o.maxScore > 0, `${id}/${o.id}: не задана цена в баллах`);
    }
  }
});
