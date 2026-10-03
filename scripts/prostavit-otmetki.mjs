/**
 * Проставляет баллы за развёрнутые ответы по готовому списку.
 *
 * Пара к `vygruzka-otvetov.mjs`: та выгружает ответы, этот возвращает в базу
 * решения по ним. Между ними стоит человек — файл `otmetki.json` можно
 * открыть и прочитать глазами, и запуск без `--go` ничего не пишет, только
 * показывает, что изменится.
 *
 * Пишет ровно то же, что кнопка в панели учителя: `manualScore`, `manualMax`,
 * `comment` и `checkedAt` точечным PATCH, не задевая ответов ученика. По
 * изменившемуся `checkedAt` ученику придёт уведомление, что работу
 * посмотрели заново, — как и после проверки руками.
 *
 * Запуск:
 *   node scripts/prostavit-otmetki.mjs почта пароль            (показать)
 *   node scripts/prostavit-otmetki.mjs почта пароль --go       (записать)
 *   node scripts/prostavit-otmetki.mjs почта пароль --go --only 7А
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SCHOOL_ID } from '../js/firebase-config.js';
import { signInWithPassword, dbGet, dbPatch } from '../js/api/firebase-rest.js';

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = `schools/${SCHOOL_ID}`;
const СПИСОК = join(КОРЕНЬ, 'otmetki.json');

async function main() {
  const args = process.argv.slice(2);
  const писать = args.includes('--go');
  const место = args.indexOf('--only');
  const только = место >= 0 ? args[место + 1] ?? null : null;
  /*
    Значение `--only` — не позиционный довод: без этой оговорки название
    класса приняли бы за пароль. Проверка `место >= 0` здесь обязательна:
    без неё `indexOf` вернёт −1, «значением» окажется довод номер ноль — и
    скрипт выбросит почту, а потом пожалуется, что её не передали.
  */
  const свои = args.filter((a, i) => !a.startsWith('--') && !(место >= 0 && i === место + 1));
  const [почта, пароль] = свои;

  if (!почта || !пароль) {
    console.error('НЕ ЗАПУЩЕНО: не хватает почты или пароля, записывать нечего.');
    console.error('Правильный запуск: node scripts/prostavit-otmetki.mjs почта пароль [--go] [--only 7А]');
    process.exit(2);
  }
  if (!почта.includes('@')) {
    console.error(`НЕ ЗАПУЩЕНО: «${почта}» не похоже на почту — первым идёт адрес, вторым пароль.`);
    process.exit(2);
  }

  const решения = JSON.parse(await readFile(СПИСОК, 'utf8'));
  const { idToken: token } = await signInWithPassword(почта, пароль);

  // Сверяемся с базой перед записью: выгрузка могла устареть, а работу
  // могли проверить руками, пока список лежал на диске.
  const работы = await dbGet(`${ROOT}/submissions`, { token });

  let записано = 0;
  let пропущено = 0;

  for (const р of решения) {
    if (только && р.class !== только) continue;

    const работа = работы?.[р.studentId]?.[р.lessonId];
    if (!работа) {
      console.log(`  ! ${р.class} · ${р.student} · ${р.lessonId}: работы в базе нет — пропускаю`);
      пропущено += 1;
      continue;
    }

    const сейчас = работа.manualScore ?? null;
    if (сейчас === р.manualScore) {
      пропущено += 1;
      continue;
    }

    // Отметка, поставленная после выгрузки, — это решение учителя, принятое
    // позже нашего. Такую работу трогать нельзя: скрипт сообщает и проходит мимо.
    if (р.было !== undefined && сейчас !== (р.было ?? null)) {
      console.log(
        `  ! ${р.class} · ${р.student} · ${р.lessonId}: в базе ${сейчас}, а в списке ждали ${р.было ?? '—'} — пропускаю`,
      );
      пропущено += 1;
      continue;
    }

    const строка = `${р.class} · ${р.student} · ${р.lessonId}: ${сейчас ?? '—'} → ${р.manualScore} из ${р.manualMax}`;
    if (!писать) {
      console.log(`  (показ) ${строка}`);
      continue;
    }

    // Комментарий отправляется, только если он в списке задан. Панель учителя
    // шлёт его всегда и пустым стирает прежний — здесь так нельзя: слово,
    // сказанное учителем ученику, не должно пропасть из-за правки балла.
    const данные = { manualScore: р.manualScore, checkedAt: Date.now() };
    if (р.comment !== undefined) данные.comment = р.comment || null;
    if (Number(р.manualMax) > 0) данные.manualMax = Number(р.manualMax);
    await dbPatch(`${ROOT}/submissions/${р.studentId}/${р.lessonId}`, данные, { token });
    console.log(`  ✓ ${строка}`);
    записано += 1;
  }

  console.log('');
  console.log(писать ? `Записано: ${записано}, пропущено: ${пропущено}` : 'Ничего не записано: это показ. Для записи добавьте --go');
  if (писать && записано) {
    console.log('Не забудьте пересчитать таблицу почёта — «Пересчитать таблицу почёта.cmd».');
  }
}

main().catch((e) => {
  console.error('Не вышло:', e.message);
  // Код возврата, а не process.exit: обрывать процесс на лету Node не любит
  // и печатает поверх сообщения «Assertion failed» из своих внутренностей —
  // учитель видит пугающую строку вместо понятной причины.
  process.exitCode = 1;
});
