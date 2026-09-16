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
import { ценность } from '../js/progress/core.js';
import { неделя } from '../js/progress/weeks.js';

const ROOT = `schools/${SCHOOL_ID}`;

/**
 * Домашние баллы одного ученика: за всё время и за текущую неделю.
 *
 * Неделя берётся по времени сдачи, а не по времени пересчёта: работа, сданная
 * в понедельник, должна попасть в эту неделю, даже если скрипт запустили в
 * пятницу.
 */
export function домашниеБаллы(работы = {}, сейчас = new Date()) {
  const текущая = неделя(сейчас);
  let всего = 0;
  let заНеделю = 0;

  for (const работа of Object.values(работы ?? {})) {
    if (!работа?.submittedAt) continue;
    const баллы = ценность({ kind: 'homework', percent: работа.percent ?? 0 });
    всего += баллы;
    if (неделя(new Date(работа.submittedAt)) === текущая) заНеделю += баллы;
  }

  return { hwXp: всего, hwWeekXp: заНеделю };
}

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

  const сейчас = new Date();
  let записано = 0;
  let пропущено = 0;

  for (const [id, ученик] of Object.entries(students ?? {})) {
    const счёт = домашниеБаллы(submissions?.[id], сейчас);
    const строка = leaderboard?.[ученик.classId]?.[id];

    /*
      Строки нет — значит, ученик ни разу не заходил на сайт под своим именем.
      Заводить её здесь нельзя: правила требуют в строке `xp` и `weekId`, а
      взять их неоткуда, да и в таблице почёта нулевая строка всё равно не
      показывается. Появится сама, как только он что-нибудь сделает.
    */
    if (!строка) {
      if (счёт.hwXp > 0) {
        console.log(`  ! ${ученик.name}: работы сданы (${счёт.hwXp}), но строки в таблице нет`);
      }
      пропущено += 1;
      continue;
    }

    if (строка.hwXp === счёт.hwXp && строка.hwWeekXp === счёт.hwWeekXp) continue;

    console.log(
      `  ${ученик.name}: ${строка.hwXp ?? '—'} → ${счёт.hwXp} ` +
      `(за неделю ${строка.hwWeekXp ?? '—'} → ${счёт.hwWeekXp}), общий счёт ${строка.xp ?? 0} не трогаем`,
    );

    if (!сухой) {
      await dbPatch(`${ROOT}/leaderboard/${ученик.classId}/${id}`, счёт, { token });
    }
    записано += 1;
  }

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
