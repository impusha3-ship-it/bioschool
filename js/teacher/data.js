import * as rest from '../api/firebase-rest.js';
import { SCHOOL_ID } from '../firebase-config.js';
import { планПересчёта } from './pereschet.js';

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
 * Все работы с развёрнутым ответом — и ждущие проверки, и уже проверенные.
 *
 * Единица здесь — работа, а не ответ: балл `manualScore` в базе один на всю
 * работу, и покажи мы каждый ответ отдельной карточкой, две карточки одного
 * ученика ставили бы один и тот же балл, перебивая друг друга.
 *
 * Проверенные не выбрасываются: промахнуться кнопкой легко, а исправить балл
 * до сих пор было нельзя — проверенная работа исчезала из очереди навсегда.
 * Непроверенные идут первыми: с ними учителю и работать.
 */
export function работыСРазвёрнутым({ students = {}, submissions = {} } = {}, { lessonId = null } = {}) {
  const работы = [];

  for (const [studentId, уроки] of Object.entries(submissions)) {
    for (const [id, работа] of Object.entries(уроки ?? {})) {
      if (lessonId && id !== lessonId) continue;

      const ответы = Object.entries(работа?.open ?? {})
        .map(([questionId, текст]) => ({ questionId, текст: String(текст ?? '') }))
        .filter((о) => о.текст.trim());
      if (!ответы.length) continue;

      работы.push({
        studentId,
        lessonId: id,
        имя: students[studentId]?.name ?? studentId,
        ответы,
        // Ноль — это выставленный балл, поэтому проверенность видна по наличию
        // поля, а не по его истинности.
        проверено: работа.manualScore !== undefined,
        manualScore: работа.manualScore,
        comment: работа.comment ?? '',
        checkedAt: работа.checkedAt ?? null,
        submittedAt: работа.submittedAt ?? 0,
      });
    }
  }

  return работы.sort((a, b) => {
    if (a.проверено !== b.проверено) return a.проверено ? 1 : -1;
    return a.submittedAt - b.submittedAt;
  });
}

/**
 * Уроки, по которым вообще есть развёрнутые ответы, — то, из чего учитель
 * выбирает на вкладке «Проверка».
 *
 * Впереди уроки, где кто-то ждёт: выбор открывается на том, ради чего на
 * вкладку и заходят. Разобранные остаются в списке — за баллом, который надо
 * поправить, приходят именно к ним.
 */
export function урокиПроверки(всё) {
  const по = new Map();

  for (const р of работыСРазвёрнутым(всё)) {
    const строка = по.get(р.lessonId) ?? { lessonId: р.lessonId, всего: 0, ждут: 0 };
    строка.всего += 1;
    if (!р.проверено) строка.ждут += 1;
    по.set(р.lessonId, строка);
  }

  return [...по.values()].sort((a, b) => b.ждут - a.ждут || a.lessonId.localeCompare(b.lessonId));
}

/**
 * Очередь развёрнутых ответов, которые ждут учителя. Считается по ответам, а
 * не по работам: это сводка «сколько всего непрочитанного».
 * Сначала те, что сданы раньше: кто первым сдал, тот первым и узнает оценку.
 */
export function очередьПроверки(всё) {
  return работыСРазвёрнутым(всё)
    .filter((р) => !р.проверено)
    .flatMap((р) => р.ответы.map((о) => ({ ...р, questionId: о.questionId, текст: о.текст })))
    .sort((a, b) => a.submittedAt - b.submittedAt);
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
   * Ставит балл за развёрнутый ответ — и ставит заново, если учитель
   * промахнулся кнопкой. Пишется точечно, чтобы не затереть работу ученика.
   *
   * Комментарий уходит всегда, и пустой стирает прежний: раз балл можно
   * поменять, вместе с ним должно уходить и слово, сказанное к старому, —
   * иначе «молодец» осталось бы висеть под переправленным нулём.
   *
   * `checkedAt` обновляется при каждой проверке. По нему ученик и узнаёт, что
   * работу посмотрели заново: уведомление приходит на изменившееся время.
   */
  async function поставитьБалл({ studentId, lessonId, score, comment = '' }) {
    const token = await getToken();
    if (!token) throw new Error('Сессия закончилась, нужно войти заново.');

    const данные = { manualScore: score, checkedAt: Date.now(), comment: comment || null };
    await api.dbPatch(`${ROOT}/submissions/${studentId}/${lessonId}`, данные, { token });
    return данные;
  }

  /**
   * Разрешает ученику переписать работу.
   *
   * Способ ровно один — стереть сданное: правила базы пускают ученика
   * писать в работу, только пока по этому уроку у него ничего нет. Значит,
   * прежние ответы и балл исчезают, сохранить их негде, и учителя об этом
   * предупреждают до нажатия.
   *
   * Урок при этом должен оставаться заданным: закрытое задание ученик не
   * сдаст, сколько ему ни разрешай.
   */
  async function разрешитьПереписать({ studentId, lessonId }) {
    const token = await getToken();
    if (!token) throw new Error('Сессия закончилась, нужно войти заново.');
    await api.dbPut(`${ROOT}/submissions/${studentId}/${lessonId}`, null, { token });
  }

  /**
   * Прогресс одного ученика — то, из чего сложились его баллы.
   *
   * Берётся по одному ученику, а не всей веткой: она читается учителем
   * целиком, но тащить прогресс всего класса ради одной раскрытой фамилии
   * незачем, а на телефоне и подавно.
   */
  async function прогрессУченика(studentId) {
    const token = await getToken();
    if (!token) throw new Error('Сессия закончилась, нужно войти заново.');
    return (await api.dbGet(`${ROOT}/progress/${studentId}`, { token })) ?? {};
  }

  /**
   * Сводит таблицу почёта со сданными работами и дописывает разошедшееся.
   *
   * Зовётся сам при открытии панели, по уже загруженным данным: учитель
   * заходит сюда постоянно, и отдельная кнопка или скрипт с паролем были бы
   * лишним шагом, о котором легко забыть. Повторный вызов ничего не меняет.
   * Пишутся только два домашних числа — общий счёт `xp`, по которому ученик
   * видит свою ступень, не трогается.
   */
  async function свестиПочёт({ students, submissions, leaderboards }, { сейчас = new Date() } = {}) {
    const token = await getToken();
    if (!token) throw new Error('Сессия закончилась, нужно войти заново.');

    const план = планПересчёта({ students, submissions, leaderboard: leaderboards, сейчас });
    for (const и of план.изменения) {
      await api.dbPatch(`${ROOT}/leaderboard/${и.classId}/${и.id}`, и.стало, { token });
      // Открытая вкладка должна видеть то же, что теперь лежит в базе.
      Object.assign(leaderboards[и.classId][и.id], и.стало);
    }
    return план;
  }

  return { загрузитьВсё, поставитьБалл, разрешитьПереписать, прогрессУченика, свестиПочёт };
}
