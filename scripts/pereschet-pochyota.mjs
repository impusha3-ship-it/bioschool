/**
 * Разовый пересчёт таблицы почёта.
 *
 * С 16 сентября 2026 почёт считается только по сданным домашним работам, и в
 * строке ученика для этого появились два новых числа: `hwXp` — домашние баллы
 * за всё время и `hwWeekXp` — за текущую неделю. У строк, записанных раньше,
 * их нет, а сама строка переписывается только тогда, когда ученик что-нибудь
 * сделает. Без пересчёта таблица в первый день показала бы пустоту, хотя
 * работы давно сданы.
 *
 * Сам подсчёт — в `js/teacher/pereschet.js`. Панель учителя делает то же
 * сама при каждом открытии, так что скрипт нужен, только если в панель
 * давно не заходили.
 *
 * Считается всё из `submissions` — из того, что ученик вправду сдал, а не из
 * его прогресса: прогресс ученик пишет себе сам, а работы принимает база по
 * своим правилам, и первая попытка в ней одна. Цена работы берётся из той же
 * `ценность`, что считает баллы на сайте, — переписывать формулу числами
 * значило бы завести вторую правду, которая однажды разойдётся с первой.
 *
 * Запуск (двойным щелчком по «Пересчитать таблицу почёта.cmd» проще):
 *   node scripts/pereschet-pochyota.mjs почта пароль
 *   node scripts/pereschet-pochyota.mjs почта пароль --dry   (только показать)
 *
 * Пароль никуда не сохраняется: уходит в Firebase и живёт в памяти до конца
 * работы скрипта.
 */
import { pathToFileURL } from 'node:url';
import { SCHOOL_ID } from '../js/firebase-config.js';
import { signInWithPassword, dbGet, dbPatch } from '../js/api/firebase-rest.js';
import { планПересчёта } from '../js/teacher/pereschet.js';

// Подсчёт живёт в общем модуле: им же пользуется панель учителя.
export { домашниеБаллы } from '../js/teacher/pereschet.js';

const ROOT = `schools/${SCHOOL_ID}`;

async function main() {
  const args = process.argv.slice(2);
  const сухой = args.includes('--dry');
  const [email, password] = args.filter((a) => !a.startsWith('--'));

  if (!email || !password) {
    console.error('Нужны почта и пароль учителя.');
    console.error('Проще всего: двойной щелчок по «Пересчитать таблицу почёта.cmd» в папке проекта.');
    console.error('Из командной строки: node scripts/pereschet-pochyota.mjs почта пароль');
    process.exit(1);
  }

  const { idToken: token } = await signInWithPassword(email, password);

  const [students, submissions, leaderboard] = await Promise.all([
    dbGet(`${ROOT}/students`, { token }),
    dbGet(`${ROOT}/submissions`, { token }),
    dbGet(`${ROOT}/leaderboard`, { token }),
  ]);

  const { изменения, безСтроки } = планПересчёта({ students, submissions, leaderboard });

  for (const у of безСтроки) {
    console.log(`  ! ${у.имя}: работы сданы (${у.hwXp}), но строки в таблице нет`);
  }

  for (const и of изменения) {
    console.log(
      `  ${и.имя}: ${и.было.hwXp ?? '—'} → ${и.стало.hwXp} ` +
      `(за неделю ${и.было.hwWeekXp ?? '—'} → ${и.стало.hwWeekXp}), общий счёт не трогаем`,
    );
    if (!сухой) {
      await dbPatch(`${ROOT}/leaderboard/${и.classId}/${и.id}`, и.стало, { token });
    }
  }

  const записано = изменения.length;
  const пропущено = безСтроки.length;

  console.log('');
  console.log(сухой
    ? `Показано: ${записано} строк изменилось бы, ${пропущено} без строки в таблице. Ничего не записано.`
    : `Готово: переписано строк — ${записано}, без строки в таблице — ${пропущено}.`);
}

// Запускается только когда скрипт позвали напрямую: подсчёт домашних баллов
// проверяется тестом, а тест не должен ни спрашивать пароль, ни лезть в сеть.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Не вышло: ${error.message}`);
    process.exit(1);
  });
}
