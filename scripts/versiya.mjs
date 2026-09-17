/**
 * Отпечаток версии сайта — `version.json` в корне.
 *
 * Открытая вкладка сверяет его с тем, с которым открылась, и, если сайт
 * обновился, перезагружается на ближайшем переходе (`js/versiya.js`).
 *
 * Отпечаток — хеш всех файлов, которые отдаёт сайт: страница, стили, код,
 * материалы уроков, картинки. Сборки у проекта нет, поэтому пересчитывать его
 * приходится перед каждой выкладкой:
 *
 *   node scripts/versiya.mjs
 *
 * Забыть нельзя: тест `test/versiya.test.js` упадёт, если отпечаток устарел.
 *
 * Переводы строк приводятся к одному виду: на Windows рабочая копия хранит
 * CRLF, в репозитории — LF, и без этого отпечаток зависел бы от того, с
 * какого компьютера его считали.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const КОРЕНЬ = fileURLToPath(new URL('..', import.meta.url));

/** Что входит в сайт. Скрипты, тесты, документы и черновики — не входят. */
const ФАЙЛЫ = ['index.html', 'favicon.svg'];
const ПАПКИ = ['css', 'js', 'content', 'img'];
const ТЕКСТ = /\.(html|css|js|mjs|json|svg|txt|md)$/i;

async function обойти(папка) {
  const найдено = [];
  for (const запись of await readdir(папка, { withFileTypes: true })) {
    const путь = join(папка, запись.name);
    if (запись.isDirectory()) найдено.push(...(await обойти(путь)));
    else найдено.push(путь);
  }
  return найдено;
}

export async function файлыСайта(корень = КОРЕНЬ) {
  const все = ФАЙЛЫ.map((ф) => join(корень, ф));
  for (const п of ПАПКИ) все.push(...(await обойти(join(корень, п))));
  return все
    .map((ф) => relative(корень, ф).split(sep).join('/'))
    .sort();
}

export async function отпечаток(корень = КОРЕНЬ) {
  const хеш = createHash('sha256');
  for (const файл of await файлыСайта(корень)) {
    let данные = await readFile(join(корень, файл));
    if (ТЕКСТ.test(файл)) данные = Buffer.from(данные.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    хеш.update(файл);
    хеш.update('\0');
    хеш.update(данные);
    хеш.update('\0');
  }
  return хеш.digest('hex').slice(0, 16);
}

export async function записанный(корень = КОРЕНЬ) {
  try {
    return JSON.parse(await readFile(join(корень, 'version.json'), 'utf8')).версия ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const версия = await отпечаток();
  const было = await записанный();
  if (было === версия) {
    console.log(`Отпечаток не изменился: ${версия}`);
    return;
  }
  await writeFile(join(КОРЕНЬ, 'version.json'), JSON.stringify({ версия }, null, 2) + '\n');
  console.log(`Отпечаток обновлён: ${было ?? '—'} → ${версия}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Не вышло: ${error.message}`);
    process.exit(1);
  });
}
