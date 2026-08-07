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
