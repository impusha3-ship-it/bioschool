import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function readJson(...parts) {
  return JSON.parse(await readFile(join(ROOT, ...parts), 'utf8'));
}

test('все файлы уроков — валидный JSON с обязательными полями', async () => {
  const dir = join(ROOT, 'content', 'lessons');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'папка с уроками пуста');

  for (const file of files) {
    const lesson = await readJson('content', 'lessons', file);
    const expectedId = file.replace(/\.json$/, '');
    assert.equal(lesson.id, expectedId, `${file}: поле id должно совпадать с именем файла`);
    assert.ok(lesson.title, `${file}: нет заголовка`);
    assert.ok(Array.isArray(lesson.summary?.blocks), `${file}: нет блоков конспекта`);
    assert.ok(
      Array.isArray(lesson.summary?.key_points) && lesson.summary.key_points.length > 0,
      `${file}: нет блока «Главное»`,
    );
  }
});

test('у блока лабораторной работы есть заголовок и ход работы', async () => {
  const dir = join(ROOT, 'content', 'lessons');
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const lesson = await readJson('content', 'lessons', file);
    for (const block of lesson.summary.blocks.filter((b) => b.type === 'lab')) {
      assert.ok(block.title, `${file}: у лабораторной нет заголовка`);
      assert.ok(
        Array.isArray(block.steps) && block.steps.length > 0,
        `${file}: у лабораторной «${block.title}» нет хода работы`,
      );
    }
  }
});

/*
  Ссылка на схему обязана вести к существующему файлу.

  Проверка нужна потому, что потеря схемы нигде не падает: отрисовщик ловит
  ошибку загрузки и молча оставляет подпись или убирает пустое место — так
  задумано, чтобы урок открывался и без картинки. Цена этой мягкости —
  опечатка в имени файла доживает до ученика. Здесь она не доживёт.

  Схемы упоминаются в четырёх местах, и все четыре проверяются: блок конспекта,
  поле игры «label», итог лабораторной работы и образец определителя.
*/
test('все упомянутые схемы существуют', async () => {
  const files = new Set(await readdir(join(ROOT, 'img', 'bio')));
  const dir = join(ROOT, 'content', 'lessons');
  let проверено = 0;

  const проверить = (src, где) => {
    if (!src) return;
    проверено += 1;
    assert.ok(/^[a-z0-9-]+\.svg$/.test(src), `${где}: имя схемы «${src}» не годится`);
    assert.ok(files.has(src), `${где}: схема «${src}» упомянута, но файла нет`);
  };

  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const lesson = await readJson('content', 'lessons', file);

    for (const block of lesson.summary.blocks) {
      if (block.type === 'figure') проверить(block.src, `${file}: блок конспекта`);
      if (block.type === 'lab') проверить(block.run?.outcome?.figure, `${file}: итог работы`);
    }

    const games = Array.isArray(lesson.game) ? lesson.game : [lesson.game].filter(Boolean);
    for (const game of games) {
      if (game.type === 'label') проверить(game.image, `${file}: игра «label»`);
      if (game.type === 'key') {
        for (const s of game.specimens ?? []) проверить(s.figure, `${file}: образец «${s.id}»`);
      }
    }
  }

  assert.ok(проверено > 0, 'схем не нашлось — проверка ничего не проверила');
});

test('курсы ссылаются только на существующие уроки', async () => {
  const lessonDir = join(ROOT, 'content', 'lessons');
  const existing = new Set(
    (await readdir(lessonDir)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')),
  );

  const courseDir = join(ROOT, 'content', 'courses');
  for (const file of (await readdir(courseDir)).filter((f) => f.endsWith('.json'))) {
    const course = await readJson('content', 'courses', file);
    for (const section of course.sections) {
      for (const entry of section.lessons) {
        assert.ok(existing.has(entry.id), `${file}: урок «${entry.id}» указан, но файла нет`);
      }
    }
  }
});

test('заголовок урока в курсе совпадает с заголовком в файле урока', async () => {
  const courseDir = join(ROOT, 'content', 'courses');
  for (const file of (await readdir(courseDir)).filter((f) => f.endsWith('.json'))) {
    const course = await readJson('content', 'courses', file);
    for (const section of course.sections) {
      for (const entry of section.lessons) {
        const lesson = await readJson('content', 'lessons', `${entry.id}.json`);
        assert.equal(
          entry.title,
          lesson.title,
          `${file}: заголовок урока «${entry.id}» разошёлся с файлом урока`,
        );
      }
    }
  }
});

test('раздел, указанный в уроке, существует в курсе его класса', async () => {
  const dir = join(ROOT, 'content', 'lessons');
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const lesson = await readJson('content', 'lessons', file);
    const course = await readJson('content', 'courses', `${lesson.grade}.json`);
    const ids = course.sections.map((s) => s.id);
    assert.ok(ids.includes(lesson.section), `${file}: раздел «${lesson.section}» не найден в курсе`);
  }
});

test('пометка о лабораторной в курсе совпадает с уроками', async () => {
  // Пометка живёт в файле курса, чтобы список уроков не скачивал все уроки
  // ради шести значков. Плата за это — возможность разойтись, и стережёт её
  // только этот тест.
  for (const grade of ['5', '6', '7', '8', '9']) {
    let курс;
    try {
      курс = await readJson('content', 'courses', `${grade}.json`);
    } catch {
      continue; // Курса ещё нет — проверять нечего.
    }

    for (const раздел of курс.sections ?? []) {
      for (const запись of раздел.lessons ?? []) {
        let урок;
        try {
          урок = await readJson('content', 'lessons', `${запись.id}.json`);
        } catch {
          continue; // Урок ещё не написан — это ловит другой тест.
        }

        const естьЛаба = (урок.summary?.blocks ?? []).some((б) => б.type === 'lab');
        assert.equal(
          Boolean(запись.lab),
          естьЛаба,
          `${запись.id}: пометка о лабораторной в курсе разошлась с уроком`,
        );
      }
    }
  }
});

/*
  Фотографии в заданиях.

  Проверяются четыре вещи, и каждая — из-за того, что молча ломается.

  Файла может не быть: отрисовщик такое переживает, и задание доезжает до
  ученика картинкой, которой нет, — а без картинки «подпиши, что изображено»
  не решается вовсе.

  Файл может быть не картинкой. Викисклад на частый запрос отвечает страницей
  ошибки с обычным кодом 200, и скачивалка кладёт её в img/bio под именем .jpg.
  Снаружи файл на месте, размер ненулевой, а внутри HTML — это уже случалось.

  Подписи alt может не быть: тогда задание нерешаемо для того, кто читает
  страницу с экрана.

  И у каждой фотографии обязан быть назван автор: снимок берётся по открытой
  лицензии, а лицензия требует указания авторства. Нет записи — нельзя
  показывать.
*/
test('фотографии заданий существуют, подписаны и с указанным автором', async () => {
  const dir = join(ROOT, 'content', 'lessons');
  const права = await readJson('content', 'foto-prava.json');
  const поФайлу = new Map(права.фотографии.map((ф) => [ф.файл, ф]));
  let проверено = 0;

  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const lesson = await readJson('content', 'lessons', file);
    const вопросы = [...(lesson.vpr ?? []), ...(lesson.homework?.questions ?? [])];

    for (const q of вопросы) {
      for (const рисунок of q.figures ?? []) {
        if (!/\.(jpg|jpeg|png|webp)$/i.test(рисунок.src)) continue;
        проверено += 1;
        const где = `${file}/${q.id}`;

        assert.ok(рисунок.alt, `${где}: у фотографии «${рисунок.src}» нет подписи alt`);

        let байты;
        try {
          байты = await readFile(join(ROOT, 'img', 'bio', рисунок.src));
        } catch {
          assert.fail(`${где}: фотографии «${рисунок.src}» нет в img/bio`);
        }

        const jpeg = байты[0] === 0xff && байты[1] === 0xd8 && байты[2] === 0xff;
        const png = байты.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        assert.ok(jpeg || png, `${где}: файл «${рисунок.src}» не картинка — внутри что-то другое`);

        const запись = поФайлу.get(рисунок.src);
        assert.ok(запись, `${где}: у фотографии «${рисунок.src}» не записаны права`);
        assert.ok(запись.автор, `${рисунок.src}: не назван автор`);
        assert.ok(запись.лицензия, `${рисунок.src}: не названа лицензия`);
      }
    }
  }

  assert.ok(проверено > 0, 'фотографий в заданиях не нашлось — проверка ничего не проверила');
});

/*
  Лицензия должна быть той, какую мы вправе взять: общественное достояние,
  CC0 или CC BY. У CC BY-SA другое требование к тому, что делает сайт целиком,
  и такие снимки решено не брать вовсе — правило из плана от 31 августа.
*/
test('лицензии фотографий из числа разрешённых', async () => {
  const права = await readJson('content', 'foto-prava.json');
  const годная = /public domain|^CC0|^CC BY(?!-SA)|^Attribution$/i;

  for (const ф of права.фотографии) {
    assert.match(ф.лицензия, годная, `${ф.файл}: лицензия «${ф.лицензия}» не из разрешённых`);
    assert.ok(ф.страница?.startsWith('https://'), `${ф.файл}: нет ссылки на страницу файла`);
  }
});
