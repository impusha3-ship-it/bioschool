/**
 * Разовая поправка: в задании «расставь зоны корня по порядку» на сайте
 * стоял неверный ключ.
 *
 * Правильный порядок от кончика — деление, растяжение, всасывание,
 * проведение (2413). В ключе стояло 2431: последними шли не проведение, а
 * всасывание. Нашёл учитель 19 октября 2026, в самом уроке и в подписи к
 * схеме порядок был верный — ошибка была только в ключе.
 *
 * Работы, сданные до исправления, проверялись старым ключом: кто ответил
 * верно, тому ответ засчитали ошибкой. Скрипт возвращает им этот балл.
 *
 * **Ответившим 2431 балл не отнимается.** Они отвечали по тому ключу,
 * который им показывал сайт, и наказывать их за нашу ошибку нельзя.
 * Поэтому правка идёт только в плюс.
 *
 * Запуск:
 *   node scripts/popravka-zon-kornya.mjs почта пароль --dry
 *   node scripts/popravka-zon-kornya.mjs почта пароль
 *
 * Пароль никуда не сохраняется: уходит в Firebase и живёт в памяти до конца
 * работы скрипта.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCHOOL_ID } from '../js/firebase-config.js';
import { signInWithPassword, dbGet, dbPatch } from '../js/api/firebase-rest.js';
import { normalizeShort } from '../js/homework/questions.js';

const КОРЕНЬ = fileURLToPath(new URL('..', import.meta.url));
const ROOT = `schools/${SCHOOL_ID}`;

export const УРОК = '6-vidy-korney';
export const ВОПРОС = 'q-6vk-hw-poryadok-zon';
/** Ключ, которым работы проверялись до исправления. */
export const СТАРЫЙ_КЛЮЧ = ['2431', '2 4 3 1', '2,4,3,1'];

/**
 * Что изменить в работе. `null` — менять нечего.
 *
 * Ответ сверяется так же, как его сверял сайт: с приведением к сравнимому
 * виду. Балл добавляется только тому, чей ответ верен по новому ключу и был
 * ошибкой по старому.
 *
 * Поправленная работа помечается `zonyFix`: без пометки второй запуск
 * прибавил бы балл ещё раз, и заметить это было бы нечем.
 */
export function поправка(работа, { новые, старые = СТАРЫЙ_КЛЮЧ } = {}) {
  if (работа?.zonyFix) return null;
  const дано = normalizeShort(работа?.answers?.[ВОПРОС]);
  if (!дано) return null;

  const верно = новые.map(normalizeShort).includes(дано);
  const считалосьВерным = старые.map(normalizeShort).includes(дано);
  if (!верно || считалосьВерным) return null;

  const total = Number(работа.total);
  const correct = Number(работа.correct);
  if (!(total > 0) || !Number.isFinite(correct)) return null;

  const стало = Math.min(correct + 1, total);
  if (стало === correct) return null;

  return { correct: стало, percent: Math.round((стало / total) * 100), zonyFix: 1 };
}

async function main() {
  const args = process.argv.slice(2);
  const сухой = args.includes('--dry');
  const [email, password] = args.filter((a) => !a.startsWith('--'));

  if (!email || !password) {
    console.error('Нужны почта и пароль учителя.');
    console.error('Из командной строки: node scripts/popravka-zon-kornya.mjs почта пароль --dry');
    process.exit(1);
  }

  const урок = JSON.parse(await readFile(join(КОРЕНЬ, 'content', 'lessons', `${УРОК}.json`), 'utf8'));
  const вопрос = (урок.homework?.questions ?? []).find((q) => q.id === ВОПРОС);
  if (!вопрос) throw new Error(`В уроке ${УРОК} нет вопроса ${ВОПРОС}`);

  const { idToken: token } = await signInWithPassword(email, password);
  const [students, submissions] = await Promise.all([
    dbGet(`${ROOT}/students`, { token }),
    dbGet(`${ROOT}/submissions`, { token }),
  ]);

  let сдали = 0;
  let уже = 0;
  const правки = [];

  for (const [studentId, работы] of Object.entries(submissions ?? {})) {
    const работа = работы?.[УРОК];
    if (!работа?.submittedAt) continue;
    сдали += 1;

    const что = поправка(работа, { новые: вопрос.answers ?? [] });
    if (!что) {
      if (СТАРЫЙ_КЛЮЧ.map(normalizeShort).includes(normalizeShort(работа.answers?.[ВОПРОС]))) уже += 1;
      continue;
    }
    правки.push({ studentId, имя: students?.[studentId]?.name ?? studentId, было: работа, стало: что });
  }

  for (const п of правки) {
    console.log(`  ${п.имя}: ответ «${п.было.answers[ВОПРОС]}» — верный. `
      + `${п.было.correct} из ${п.было.total} (${п.было.percent}%) → ${п.стало.correct} (${п.стало.percent}%)`);
    if (!сухой) await dbPatch(`${ROOT}/submissions/${п.studentId}/${УРОК}`, п.стало, { token });
  }

  console.log('');
  console.log(`Работ по уроку: ${сдали}. Ответили верно по новому ключу и недополучили балл: ${правки.length}.`);
  console.log(`Ответили по старому ключу (балл не трогаем): ${уже}.`);
  console.log(сухой ? 'Это был показ — ничего не записано.' : 'Записано.');
  if (!сухой && правки.length) {
    console.log('Дальше: «Пересчитать таблицу почёта.cmd» и заново посчитать отметки.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Не вышло: ${error.message}`);
    process.exit(1);
  });
}
