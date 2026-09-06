/**
 * Что из заданий ВПР уже разошлось по урокам.
 *
 * Каталог заданий большой, темы в нём пересекаются, и одно и то же задание
 * легко поставить в два урока: формулировки в каталоге повторяются почти
 * дословно из года в год. Ученик такое замечает сразу и перестаёт верить
 * тренажёру — «это уже было». Поэтому перед тем, как отбирать задания для
 * нового урока, стоит посмотреть, что уже занято.
 *
 * Сверять надо по началу текста, а не по номеру: номер каталога в файле урока
 * не хранится, там стоит только год и вариант работы.
 *
 *   node scripts/vpr-ispolzovannye.mjs           — все уроки
 *   node scripts/vpr-ispolzovannye.mjs 7         — только уроки 7 класса
 *   node scripts/vpr-ispolzovannye.mjs 7 заросток — ещё и с поиском по слову
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const [класс, слово] = process.argv.slice(2);

async function json(...части) {
  return JSON.parse(await readFile(join(ROOT, ...части), 'utf8'));
}

/** Уроки, на которые ссылаются курсы: только они и показываются ученику. */
async function уроки() {
  const dir = join(ROOT, 'content', 'courses');
  const ids = [];
  for (const файл of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
    const курс = await json('content', 'courses', файл);
    for (const раздел of курс.sections) for (const у of раздел.lessons) ids.push(у.id);
  }
  return класс ? ids.filter((id) => id.startsWith(`${класс}-`)) : ids;
}

const строки = [];
for (const id of await уроки()) {
  const урок = await json('content', 'lessons', `${id}.json`);
  const задания = [...(урок.vpr ?? []), ...(урок.homework?.questions ?? [])]
    .filter((з) => з.exam === 'ВПР');
  for (const з of задания) {
    const начало = (з.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 96);
    строки.push({ id, где: урок.vpr?.includes(з) ? 'тренажёр' : 'домашка', задание: з, начало });
  }
}

const выбранные = слово
  ? строки.filter((с) => (с.задание.text ?? '').toLowerCase().includes(слово.toLowerCase()))
  : строки;

let урокСейчас = null;
for (const с of выбранные) {
  if (с.id !== урокСейчас) {
    урокСейчас = с.id;
    console.log(`\n${с.id}`);
  }
  const источник = с.задание.source ?? 'без источника — задание своё';
  console.log(`  ${с.где.padEnd(9)} ${(с.задание.type ?? '').padEnd(6)} ${источник}`);
  console.log(`            ${с.начало}...`);
}

const свои = выбранные.filter((с) => !с.задание.source).length;
console.log(
  `\nВсего заданий ВПР: ${выбранные.length}`
  + (класс ? ` (в уроках ${класс} класса)` : '')
  + (слово ? `, из них со словом «${слово}»` : '')
  + `. Настоящих ${выбранные.length - свои}, своих ${свои}.`,
);
