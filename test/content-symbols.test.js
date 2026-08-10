import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/*
  Текст урока пишется руками, и в него дважды за одну сессию попадал иероглиф
  из чужой раскладки. На странице такое выглядит как случайный мусор посреди
  предложения, а глазом при вычитке не ловится совсем. Проверка дешёвая,
  поэтому пусть будет.
*/

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Кириллица, латиница, цифры, пробелы и типографика, которой мы пользуемся. */
const РАЗРЕШЕНО = /[ -~ -¿Ѐ-ӿ‐-―‘-‟…°×−«»\n\r\t]/u;

async function файлы(dir, ext) {
  const путь = join(ROOT, dir);
  return (await readdir(путь)).filter((f) => f.endsWith(ext)).map((f) => [dir, f]);
}

test('в контенте и схемах нет посторонних символов', async () => {
  const список = [
    ...(await файлы('content/lessons', '.json')),
    ...(await файлы('content/courses', '.json')),
    ...(await файлы('img/bio', '.svg')),
  ];

  const находки = [];
  for (const [dir, file] of список) {
    const текст = await readFile(join(ROOT, dir, file), 'utf8');
    for (const символ of текст) {
      if (!РАЗРЕШЕНО.test(символ)) {
        const код = символ.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        находки.push(`${dir}/${file}: «${символ}» (U+${код})`);
      }
    }
  }

  assert.deepEqual([...new Set(находки)], [], 'найдены символы не из русского текста');
});
