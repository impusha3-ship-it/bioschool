/**
 * Пересобирает `content/klassy.json` — список классов, до которых уроки уже
 * написаны, и сколько их в каждом.
 *
 * Зачем список отдельным файлом. Главная показывает, какие годы готовы, а
 * какие ещё пишутся, и сколько уроков лежит в каждом. Узнать это по файлам
 * курсов нельзя: каталог на GitHub Pages не перечисляется, и главная была
 * вынуждена запрашивать все пять курсов и считать ответом 404 «ещё не
 * написан». В консоли от этого висели три ошибки, три запроса уходили в
 * пустоту, а карточки годов дёргались, когда ответы приходили. Один маленький
 * файл отвечает на всё это сразу и до первой отрисовки.
 *
 * Плата за это — возможность разойтись с файлами курсов. Стережёт её тест
 * «список классов совпадает с файлами курсов»: он же и подскажет запустить
 * этот скрипт.
 *
 *   node scripts/spisok-klassov.mjs
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Считает по файлам курсов, что должно лежать в списке. */
export async function собрать(корень = ROOT) {
  const каталог = join(корень, 'content', 'courses');
  const файлы = (await readdir(каталог)).filter((ф) => /^[5-9]\.json$/.test(ф)).sort();

  const классы = [];
  for (const файл of файлы) {
    const курс = JSON.parse(await readFile(join(каталог, файл), 'utf8'));
    const уроков = (курс.sections ?? []).reduce(
      (сумма, раздел) => сумма + (раздел.lessons?.length ?? 0),
      0,
    );
    // Класс, у которого файл курса есть, но уроков в нём ещё нет, для главной
    // ничем не отличается от класса без файла: открывать там нечего.
    if (уроков > 0) классы.push({ класс: Number(файл[0]), уроков });
  }
  return { классы };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('spisok-klassov.mjs')) {
  const список = await собрать();
  const путь = join(ROOT, 'content', 'klassy.json');
  await writeFile(путь, `${JSON.stringify(список, null, 2)}\n`, 'utf8');
  const строки = список.классы.map((к) => `${к.класс} класс — ${к.уроков}`).join(', ');
  console.log(`content/klassy.json обновлён: ${строки || 'пока пусто'}`);
}
