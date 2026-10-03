/**
 * Выгрузка развёрнутых ответов из сданных работ — в файл на диске.
 *
 * Читать `submissions` в базе может только учитель: так написаны правила.
 * Поэтому скрипт запускает учитель у себя, своей почтой и паролем, а пароль
 * никуда не сохраняется — уходит в Firebase и живёт в памяти до конца работы
 * скрипта, ровно как в «Пересчитать таблицу почёта».
 *
 * На выходе — `otvety-na-proverku.json` рядом с проектом: по каждой работе
 * сам ответ ученика, вопрос, ключ, цена в баллах и та отметка, которая уже
 * стоит. Этот файл можно отдать на разбор: в нём нет ни паролей, ни ключей
 * доступа, только имена, задания и ответы.
 *
 * Запуск:
 *   node scripts/vygruzka-otvetov.mjs почта пароль
 *   node scripts/vygruzka-otvetov.mjs почта пароль --class 7А   (только один класс)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SCHOOL_ID } from '../js/firebase-config.js';
import { signInWithPassword, dbGet } from '../js/api/firebase-rest.js';

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = `schools/${SCHOOL_ID}`;
const ВЫХОД = join(КОРЕНЬ, 'otvety-na-proverku.json');

/**
 * Развёрнутые задания урока. Их два места — вопрос с типом `open` среди
 * обычных вопросов домашки и задание в конце, — и панель учителя собирает их
 * тем же способом.
 */
function развёрнутыеЗадания(урок) {
  const изВопросов = (урок?.homework?.questions ?? []).filter((q) => q?.type === 'open');
  const вКонце = урок?.homework?.open ?? [];
  return [...изВопросов, ...вКонце];
}

/** Уроки читаются с диска, а не с сайта: скрипту незачем ходить в сеть за своим же. */
const уроки = new Map();
async function урок(lessonId) {
  if (уроки.has(lessonId)) return уроки.get(lessonId);
  let данные = null;
  try {
    данные = JSON.parse(await readFile(join(КОРЕНЬ, 'content', 'lessons', `${lessonId}.json`), 'utf8'));
  } catch {
    // Урок могли переименовать или убрать — работа всё равно должна попасть
    // в выгрузку, просто без вопроса и без цены.
  }
  уроки.set(lessonId, данные);
  return данные;
}

async function main() {
  const args = process.argv.slice(2);
  const [почта, пароль] = args.filter((a) => !a.startsWith('--'));
  const только = args.includes('--class') ? args[args.indexOf('--class') + 1] : null;

  if (!почта || !пароль) {
    console.error('Запуск: node scripts/vygruzka-otvetov.mjs почта пароль [--class 7А]');
    process.exit(2);
  }

  const { idToken: token } = await signInWithPassword(почта, пароль);

  const [классы, ученики, работы] = await Promise.all([
    dbGet(`${ROOT}/classes`, { token }),
    dbGet(`${ROOT}/students`, { token }),
    dbGet(`${ROOT}/submissions`, { token }),
  ]);

  const строки = [];
  for (const [studentId, поУрокам] of Object.entries(работы ?? {})) {
    const ученик = ученики?.[studentId];
    const название = классы?.[ученик?.classId]?.title ?? '';
    if (только && название !== только) continue;

    for (const [lessonId, работа] of Object.entries(поУрокам ?? {})) {
      const ответы = работа?.open ?? {};
      if (!Object.keys(ответы).length) continue;

      const у = await урок(lessonId);
      const задания = new Map(развёрнутыеЗадания(у).map((q) => [q.id, q]));

      строки.push({
        class: название,
        classId: ученик?.classId ?? null,
        student: ученик?.name ?? studentId,
        studentId,
        lessonId,
        lesson: у?.title ?? null,
        submittedAt: работа.submittedAt ?? null,
        isLate: Boolean(работа.isLate),
        auto: { correct: работа.correct ?? null, total: работа.total ?? null },
        manualScore: работа.manualScore ?? null,
        manualMax: работа.manualMax ?? null,
        checkedAt: работа.checkedAt ?? null,
        // Слово учителя к баллу: часто в нём и лежит объяснение, почему
        // балл именно такой. Без него расхождения не разобрать.
        comment: работа.comment ?? null,
        otvety: Object.entries(ответы).map(([id, текст]) => {
          const q = задания.get(id);
          return {
            id,
            vopros: q?.prompt ?? q?.text ?? null,
            max: q?.maxScore ?? null,
            klyuch: q?.answerKey ?? null,
            otvet: String(текст ?? ''),
          };
        }),
      });
    }
  }

  строки.sort((a, b) => (a.class + a.student + a.lessonId).localeCompare(b.class + b.student + b.lessonId, 'ru'));
  await writeFile(ВЫХОД, JSON.stringify(строки, null, 2), 'utf8');

  const проверено = строки.filter((с) => с.manualScore !== null).length;
  console.log(`Выгружено работ с развёрнутым ответом: ${строки.length}`);
  console.log(`  уже с отметкой: ${проверено}`);
  console.log(`  без отметки:    ${строки.length - проверено}`);
  console.log(`Файл: ${ВЫХОД}`);
}

main().catch((e) => {
  console.error('Не вышло:', e.message);
  // Код возврата, а не process.exit: обрывать процесс на лету Node не любит
  // и печатает поверх сообщения «Assertion failed» из своих внутренностей —
  // учитель видит пугающую строку вместо понятной причины.
  process.exitCode = 1;
});
