import * as rest from '../api/firebase-rest.js';
import { SCHOOL_ID } from '../firebase-config.js';

const ROOT = `schools/${SCHOOL_ID}`;

/** Статусы клетки журнала. Порядок важен: по нему считается сводка. */
export const СТАТУСЫ = {
  НЕ_ЗАДАНО: 'не задано',
  НЕ_СДАНО: 'не сдано',
  ЖДЁТ: 'ждёт проверки',
  С_ОПОЗДАНИЕМ: 'с опозданием',
  СДАНО: 'сдано',
};

/**
 * Определяет, что показывать в клетке журнала.
 *
 * «Ждёт проверки» важнее «с опозданием»: учителю нужно в первую очередь
 * знать, где от неё требуется действие, а опоздание — это уже подробность
 * внутри сданной работы.
 */
export function статусКлетки({ назначено, работа }) {
  if (!назначено) return СТАТУСЫ.НЕ_ЗАДАНО;
  if (!работа) return СТАТУСЫ.НЕ_СДАНО;
  const естьРазвёрнутый = Boolean(работа.open && Object.keys(работа.open).length);
  if (естьРазвёрнутый && работа.manualScore === undefined) return СТАТУСЫ.ЖДЁТ;
  if (работа.isLate) return СТАТУСЫ.С_ОПОЗДАНИЕМ;
  return СТАТУСЫ.СДАНО;
}

/**
 * Собирает журнал одного класса: строки — ученики, столбцы — заданные уроки.
 * Чистая функция: получает уже загруженные данные и ничего не запрашивает.
 */
export function собратьЖурнал({ classId, students = {}, assignments = {}, submissions = {} }) {
  const уроки = Object.entries(assignments[classId] ?? {})
    .map(([lessonId, a]) => ({ lessonId, ...a }))
    .sort((a, b) => (a.assignedAt ?? 0) - (b.assignedAt ?? 0));

  const ученики = Object.entries(students)
    .filter(([, s]) => s.classId === classId)
    .map(([id, s]) => ({ id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const строки = ученики.map((ученик) => {
    const работы = submissions[ученик.id] ?? {};
    const клетки = уроки.map((урок) => {
      const работа = работы[урок.lessonId] ?? null;
      return {
        lessonId: урок.lessonId,
        статус: статусКлетки({ назначено: true, работа }),
        percent: работа?.percent ?? null,
        работа,
      };
    });
    return { ...ученик, клетки, сдано: клетки.filter((к) => к.статус !== СТАТУСЫ.НЕ_СДАНО).length };
  });

  return { уроки, строки };
}

/**
 * Очередь развёрнутых ответов, которые ждут учителя.
 * Сначала те, что сданы раньше: кто первым сдал, тот первым и узнает оценку.
 */
export function очередьПроверки({ students = {}, submissions = {} }) {
  const очередь = [];

  for (const [studentId, работы] of Object.entries(submissions)) {
    for (const [lessonId, работа] of Object.entries(работы ?? {})) {
      if (!работа?.open || работа.manualScore !== undefined) continue;
      for (const [questionId, текст] of Object.entries(работа.open)) {
        if (!String(текст ?? '').trim()) continue;
        очередь.push({
          studentId,
          lessonId,
          questionId,
          имя: students[studentId]?.name ?? studentId,
          текст,
          submittedAt: работа.submittedAt ?? 0,
        });
      }
    }
  }

  return очередь.sort((a, b) => a.submittedAt - b.submittedAt);
}

export function createTeacherData({ api = rest, getToken } = {}) {
  async function загрузитьВсё() {
    const token = await getToken();
    if (!token) throw new Error('Сессия закончилась, нужно войти заново.');

    const [classes, students, assignments, submissions, leaderboards] = await Promise.all([
      api.dbGet(`${ROOT}/classes`, { token }),
      api.dbGet(`${ROOT}/students`, { token }),
      api.dbGet(`${ROOT}/assignments`, { token }),
      api.dbGet(`${ROOT}/submissions`, { token }),
      // Таблицы баллов лежат разложенными по классам, поэтому берутся одним
      // запросом. Пустая таблица — это ноль баллов, а не сбой: до первой игры
      // её просто нет, и ронять из-за этого всю панель нельзя.
      api.dbGet(`${ROOT}/leaderboard`, { token }).catch(() => null),
    ]);

    return {
      classes: classes ?? {},
      students: students ?? {},
      assignments: assignments ?? {},
      submissions: submissions ?? {},
      leaderboards: leaderboards ?? {},
    };
  }

  /**
   * Ставит балл за развёрнутый ответ.
   * Пишется точечно, чтобы не затереть остальную работу ученика.
   */
  async function поставитьБалл({ studentId, lessonId, score, comment }) {
    const token = await getToken();
    const данные = { manualScore: score, checkedAt: Date.now() };
    if (comment) данные.comment = comment;
    await api.dbPatch(`${ROOT}/submissions/${studentId}/${lessonId}`, данные, { token });
    return данные;
  }

  return { загрузитьВсё, поставитьБалл };
}
