import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { makeFakeDocument } from './helpers/fake-dom.js';
import { createGame } from '../js/games/index.js';
import { scoreQuestions, openQuestions } from '../js/homework/questions.js';
import { развёрнутыеЗадания } from '../js/homework/pochyot.js';

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

/** Все проверяемые машиной вопросы урока: и домашка, и тренажёр ВПР. */
function всеВопросы(lesson) {
  return [...(lesson.homework?.questions ?? []), ...(lesson.vpr ?? [])];
}

/*
  Сколько заданий держать. Домашка коротка нарочно: восемь вопросов
  пятикласснику на вечер — уже много, и добирать количество надо не там.
  Тренажёр же ничего не стоит — ошибиться в нём бесплатно, и туда идёт
  основной объём.

  Считаются любые задания, а не только настоящие: решение учителя от
  13 сентября 2026 — своё задание нельзя выдавать за задание ВПР. Если по
  теме настоящих нет, урок берёт свои вопросы по материалу и метку `exam`
  им не ставит. За тем, чтобы уроки от этого не съехали на свои задания
  целиком, следит отдельная проверка ниже: общее число настоящих заданий
  по всем урокам может только расти.
*/
const МИНИМУМ_ДОМАШКА = 3;
const МИНИМУМ_ТРЕНАЖЁР = 4;

/*
  Настоящих заданий на сайте столько. Планка только снизу: заменил своё
  задание настоящим — подними число, и оно больше не опустится.
*/
const НАСТОЯЩИХ_ВСЕГО = 375;

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
    assert.ok(lesson.materials?.length, `${id}: нет материалов`);
  }
});

test('в домашке каждого урока хватает проверяемых заданий', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const вопросы = lesson.homework.questions ?? [];
    assert.ok(
      вопросы.length >= МИНИМУМ_ДОМАШКА,
      `${id}: вопросов в домашке ${вопросы.length}, нужно ${МИНИМУМ_ДОМАШКА}`,
    );
  }
});

/*
  Метка «ВПР» — это утверждение о происхождении задания, а не о его виде.
  Формулировку можно написать в том же духе, но назвать её заданием
  проверочной работы, не имея источника, значит соврать ученику: он
  решит, что видел настоящую работу, а видел мою выдумку.
*/
test('меткой ВПР помечены только задания с источником', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const все = [...(lesson.vpr ?? []), ...(lesson.homework?.questions ?? [])];
    for (const q of все) {
      if (q.exam !== 'ВПР') continue;
      assert.ok(q.source, `${id}/${q.id}: помечено как ВПР, но источник не указан`);
    }
  }
});

test('настоящих заданий на сайте не становится меньше', async () => {
  let настоящих = 0;
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const все = [...(lesson.vpr ?? []), ...(lesson.homework?.questions ?? [])];
    настоящих += все.filter((q) => q.source).length;
  }
  assert.ok(
    настоящих >= НАСТОЯЩИХ_ВСЕГО,
    `настоящих заданий ${настоящих}, было ${НАСТОЯЩИХ_ВСЕГО}: своё задание не заменяет настоящее`,
  );
});

/*
  Тренажёр ВПР — место, где формулировка проверочной работы встречается
  ученику до самой работы. Разбор здесь обязателен: без него «неверно»
  ничему не учит, а тренажёр не за оценку и держится только на том, что
  из него что-то понятно.
*/
test('у каждого урока есть блок ВПР в тренажёре, и каждое задание с разбором', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const впр = lesson.vpr ?? [];

    assert.ok(
      впр.length >= МИНИМУМ_ТРЕНАЖЁР,
      `${id}: заданий в тренажёре ${впр.length}, нужно ${МИНИМУМ_ТРЕНАЖЁР}`,
    );

    for (const q of впр) {
      assert.ok(q.explanation, `${id}/${q.id}: задание без разбора`);
      assert.ok(
        ['choice', 'multi', 'short', 'open'].includes(q.type),
        `${id}/${q.id}: тип «${q.type}» в тренажёре не показывается`,
      );

      /*
        Развёрнутый ответ машина не проверяет — его сверяет с ключом сам
        ученик. Значит, ключ обязан быть: без него задание превращается
        в поле, куда написал и не узнал ничего.
      */
      if (q.type === 'open') {
        assert.ok(q.answerKey, `${id}/${q.id}: развёрнутое задание без ключа, сверять не с чем`);
        assert.ok(q.maxScore > 0, `${id}/${q.id}: у развёрнутого задания не задана цена в баллах`);
      }
    }
  }
});

test('внутри урока номера вопросов не повторяются', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const ids = [...всеВопросы(lesson), ...(lesson.homework.open ?? [])].map((q) => q.id);
    const набор = new Set(ids);
    assert.equal(набор.size, ids.length, `${id}: два вопроса с одинаковым id`);
  }
});

/*
  Лабораторная без интерактива — это текст, который никто не выполнит:
  практические вживую почти не проводятся, и для большинства учеников сайт
  остаётся единственным местом, где они увидят, чем работа кончается.
  Поэтому у каждой размеченной работы должна быть проходимая версия.

  Сборка проверяет заодно и содержательное: что на каждом шаге ровно один
  верный вариант и что у каждого неверного назван его последствие. Молчаливая
  ошибка не учит ничему — ученик так и не узнает, чем его выбор плох.
*/
test('у каждой лабораторной работы есть проходимая версия', async () => {
  let работ = 0;
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    for (const block of lesson.summary.blocks.filter((b) => b.type === 'lab')) {
      работ += 1;
      assert.ok(block.run, `${id}: у работы «${block.title}» нет интерактивной версии`);
      assert.doesNotThrow(
        () => createGame({ ...block.run, type: 'lab' }, { document: makeFakeDocument() }),
        `${id}: работа «${block.title}» не собралась`,
      );
      assert.ok(
        block.run.stages.length >= 4,
        `${id}: в работе «${block.title}» ${block.run.stages.length} шагов, нужно хотя бы 4`,
      );
      assert.ok(
        block.run.outcome?.text,
        `${id}: у работы «${block.title}» не показан результат — ради него работу и проводят`,
      );
    }
  }
  assert.ok(работ > 0, 'лабораторных не нашлось — проверка ничего не проверила');
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
    for (const q of всеВопросы(lesson).filter((x) => x.type === 'short')) {
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
    for (const q of всеВопросы(lesson)) {
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
    for (const q of всеВопросы(lesson).filter((x) => x.options)) {
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
    for (const q of всеВопросы(lesson)) {
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

/*
  Подсказка под развёрнутым заданием видна ученику до ответа, ключ — только
  учителю. До 17 сентября 2026 в подсказках стоял сам ответ: «Налёт — плесневый
  гриб, его споры есть в воздухе…». Смысл машине не проверить, но переписанный
  из ключа кусок она поймает: пять слов подряд, общих для подсказки и ключа,
  — это уже не наводка, а ответ.
*/
test('подсказка к развёрнутому заданию не повторяет ключ', async () => {
  const слова = (т) => т.toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu) ?? [];
  const ДЛИНА = 5;

  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    for (const o of lesson.homework.open) {
      if (!o.answerKey || !o.hint) continue;
      const ключ = слова(o.answerKey);
      const куски = new Set();
      for (let i = 0; i + ДЛИНА <= ключ.length; i += 1) куски.add(ключ.slice(i, i + ДЛИНА).join(' '));
      const подсказка = слова(o.hint);
      for (let i = 0; i + ДЛИНА <= подсказка.length; i += 1) {
        const кусок = подсказка.slice(i, i + ДЛИНА).join(' ');
        assert.ok(!куски.has(кусок), `${id}/${o.id}: подсказка повторяет ключ — «${кусок}»`);
      }
    }
  }
});

/*
  Проверка выше ловит подсказку, переписанную из ключа, но ключа у развёрнутых
  заданий домашки нет ни у одного: там только `prompt` и `hint`. Значит, она
  не проверяла ничего, и 21 сентября 2026 это вылезло: задание просило назвать
  три причины, а подсказка перечисляла четыре — ученику оставалось списать.

  Смысл машине по-прежнему не проверить, но у перечисления есть след. Задание
  просит назвать понятия, а понятия урока собраны в его же словаре. Если
  подсказка прямым текстом называет три термина и больше, она не наводит на
  мысль, а выдаёт ответ. Порог в три взят по замеру: у самой «болтливой» из
  честных подсказок терминов два, и оба попали в неё случайным словом.
*/
test('подсказка не выдаёт ответ списком терминов урока', async () => {
  const упростить = (т) => т.toLowerCase().replace(/ё/g, 'е');
  const ПОТОЛОК = 2;

  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const термины = (lesson.summary?.terms ?? []).map((t) => upperFirst(t.term));

    for (const o of lesson.homework.open) {
      if (!o.hint) continue;
      const подсказка = упростить(o.hint);
      const названы = термины.filter((t) => подсказка.includes(t));
      assert.ok(
        названы.length <= ПОТОЛОК,
        `${id}/${o.id}: подсказка называет ${названы.length} терминов урока (${названы.join(', ')}) — это уже ответ`,
      );
    }
  }

  // Термин вида «Вегетативная (автономная) нервная система» в подсказке
  // встретится без скобок, поэтому сравнивается его начало.
  function upperFirst(term) {
    return упростить(term).split('(')[0].trim();
  }
});

/*
  До 17 сентября 2026 в 8 классе верным во всех 35 вопросах с одним ответом
  был первый вариант, а во всех 11 с несколькими — первые подряд: домашка
  решалась без знания. Страж смотрит на класс целиком и ловит перекос, а не
  случайную пару совпадений. Порог взят с запасом: в 5 классе второй вариант
  верен в 59% вопросов домашки — это много, но ещё не «всегда».
*/
test('верный вариант не стоит всегда на одном месте', async () => {
  const поКлассам = {};
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);
    const класс = id.split('-')[0];
    for (const [где, список] of [['домашка', lesson.homework?.questions ?? []], ['тренажёр', lesson.vpr ?? []]]) {
      const с = (поКлассам[`${класс} класс, ${где}`] ??= { места: {}, одиночных: 0, подряд: 0, множественных: 0 });
      for (const q of список) {
        // «Верно только А / только Б / оба / ни одного» — формат настоящей
        // работы с постоянным порядком, его не мешают.
        if (q.options?.some((o) => /^верно только [АБ]$/i.test(o))) continue;
        if (q.type === 'choice') {
          с.одиночных += 1;
          с.места[q.correct] = (с.места[q.correct] ?? 0) + 1;
        }
        if (q.type === 'multi') {
          с.множественных += 1;
          const верные = [...q.correct].sort((a, b) => a - b);
          if (верные.every((v, i) => v === i)) с.подряд += 1;
        }
      }
    }
  }

  for (const [где, с] of Object.entries(поКлассам)) {
    if (с.одиночных >= 20) {
      const [место, сколько] = Object.entries(с.места).sort((a, b) => b[1] - a[1])[0];
      assert.ok(сколько / с.одиночных <= 0.6,
        `${где}: верный вариант на месте ${Number(место) + 1} в ${сколько} из ${с.одиночных} вопросов`);
    }
    if (с.множественных >= 10) {
      assert.ok(с.подряд / с.множественных <= 0.5,
        `${где}: верные — первые подряд в ${с.подряд} из ${с.множественных} вопросов`);
    }
  }
});

/*
  Таблица перестановок переводит старые работы в новый порядок вариантов.
  Испорченная перестановка перевела бы ответ на чужой вариант — молча.
*/
test('таблица перестановок сходится с уроками', async () => {
  const таблица = await readJson('content', 'perestanovki.json');
  for (const [версия, уроки] of Object.entries(таблица)) {
    for (const [id, вопросы] of Object.entries(уроки)) {
      const lesson = await readJson('content', 'lessons', `${id}.json`);
      for (const [qid, куда] of Object.entries(вопросы)) {
        const q = (lesson.homework?.questions ?? []).find((x) => x.id === qid);
        assert.ok(q, `порядок ${версия}: ${id}/${qid} нет в домашке`);
        assert.equal(куда.length, q.options.length, `${id}/${qid}: длина перестановки`);
        assert.deepEqual([...куда].sort((a, b) => a - b), [...куда.keys()], `${id}/${qid}: не перестановка`);
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

/*
  Учитель проверяет развёрнутые ответы в панели, и рядом с каждым должна
  стоять его формулировка: сверять тридцать работ по памяти — это тридцать
  шансов оценить одинаковые ответы по-разному. Панель ищет формулировку по
  идентификатору ответа, а сами ответы собираются при сдаче из двух мест —
  вопросов домашки и задания в конце.

  23 сентября 2026 выяснилось, что панель смотрела только во второе место, и
  сорок одно задание доезжало до учителя голым ответом. Здесь проверяется не
  панель, а то, на чём она стоит: всё, что уйдёт учителю, должно в уроке
  находиться — и с формулировкой, и с ценой в баллах.
*/
test('у каждого развёрнутого ответа учитель найдёт вопрос', async () => {
  for (const id of await заданныеУроки()) {
    const lesson = await readJson('content', 'lessons', `${id}.json`);

    // Ровно так домашка собирает то, что уйдёт в базу под ключом `open`.
    const уйдётУчителю = openQuestions([
      ...(lesson.homework?.questions ?? []),
      ...(lesson.homework?.open ?? []).map((q) => ({ ...q, type: 'open' })),
    ]).map((q) => q.id);

    // А так панель проверки собирает формулировки.
    const найдёт = new Map(развёрнутыеЗадания(lesson).map((q) => [q.id, q]));

    for (const qid of уйдётУчителю) {
      const задание = найдёт.get(qid);
      assert.ok(задание, `${id}/${qid}: ответ уйдёт учителю, а формулировки в панели не будет`);
      assert.ok(задание.prompt || задание.text, `${id}/${qid}: у развёрнутого задания нет формулировки`);
      assert.ok(задание.maxScore > 0, `${id}/${qid}: не задана цена в баллах — её складывают в максимум`);
    }
  }
});
