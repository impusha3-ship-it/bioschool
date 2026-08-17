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
