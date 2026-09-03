import { el } from '../ui/dom.js';
import { полоса } from '../ui/bar.js';
import * as rest from '../api/firebase-rest.js';
import { SCHOOL_ID } from '../firebase-config.js';
import { неделя as неделяИз } from '../progress/weeks.js';

const ROOT = `schools/${SCHOOL_ID}`;

const ЛУЧШИХ_ПО_ШКОЛЕ = 5;
const ЛУЧШИХ_ПО_КЛАССУ = 3;

/**
 * Собирает табло: лучшие по всей школе и по каждому классу отдельно.
 *
 * Чистая функция — данные приходят готовыми. Списки строятся от `students`,
 * а не от самой таблицы баллов: таблица открыта на чтение и на запись
 * каждому за свою строку, и брать из неё список учеников значило бы верить
 * тому, что туда написали. Правила чужую строку не пустят, но проверка по
 * списку дешевле доверия.
 */
export function собратьТабло({ classes = {}, students = {}, leaderboard = {}, assignments = {}, неделя } = {}) {
  const строки = Object.entries(students).map(([id, ученик]) => {
    const запись = leaderboard?.[ученик.classId]?.[id] ?? {};
    return {
      id,
      имя: ученик.name,
      classId: ученик.classId,
      класс: classes[ученик.classId]?.title ?? '',
      xp: число(запись.xp),
      weekXp: запись.weekId === неделя ? число(запись.weekXp) : 0,
      lessonsDone: число(запись.lessonsDone),
    };
  });

  const поВсегда = (сп) => сп.filter((с) => с.xp > 0).sort((a, b) => b.xp - a.xp);
  const поНеделе = (сп) => сп.filter((с) => с.weekXp > 0).sort((a, b) => b.weekXp - a.weekXp);

  return {
    школа: {
      всегда: поВсегда(строки).slice(0, ЛУЧШИХ_ПО_ШКОЛЕ),
      неделя: поНеделе(строки).slice(0, ЛУЧШИХ_ПО_ШКОЛЕ),
    },
    классы: Object.entries(classes).map(([id, класс]) => {
      const свои = строки.filter((с) => с.classId === id);
      // Цель считается сама: сколько учеников на сколько заданных уроков.
      const цель = свои.length * Object.keys(assignments?.[id] ?? {}).length;
      const пройдено = свои.reduce((n, с) => n + с.lessonsDone, 0);
      return {
        id,
        title: класс.title,
        учеников: свои.length,
        пройдено,
        цель,
        процент: цель ? Math.round((пройдено / цель) * 100) : 0,
        неделя: поНеделе(свои).slice(0, ЛУЧШИХ_ПО_КЛАССУ),
        всегда: поВсегда(свои).slice(0, ЛУЧШИХ_ПО_КЛАССУ),
      };
    }),
  };
}

function число(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Табло. Показывается с проектора в начале урока, поэтому входа не требует:
 * и таблица баллов, и списки классов открыты на чтение. Ссылки в меню на
 * него нарочно нет — открывает его учитель, когда сам решил показать.
 */
export async function renderTabloPage() {
  const блок = el('section', { class: 'tablo' }, [
    el('h1', { class: 'tablo__title' }, 'Табло'),
    el('p', { class: 'loading' }, 'Загружаю…'),
  ]);

  наполнить(блок);
  return блок;
}

async function наполнить(блок) {
  let данные;
  try {
    const [classes, students, leaderboard, assignments] = await Promise.all([
      rest.dbGet(`${ROOT}/classes`),
      rest.dbGet(`${ROOT}/students`),
      rest.dbGet(`${ROOT}/leaderboard`),
      rest.dbGet(`${ROOT}/assignments`),
    ]);
    данные = собратьТабло({
      classes: classes ?? {},
      students: students ?? {},
      leaderboard: leaderboard ?? {},
      assignments: assignments ?? {},
      неделя: неделяИз(new Date()),
    });
  } catch (error) {
    блок.replaceChildren(
      el('h1', { class: 'tablo__title' }, 'Табло'),
      el('p', { class: 'login__error' }, `Не открылось: ${error.message}`),
    );
    return;
  }

  блок.replaceChildren(
    el('h1', { class: 'tablo__title' }, 'Табло'),
    столбцыШколы(данные.школа),
    ...данные.классы.map(карточкаКласса),
  );
}

function столбцыШколы(школа) {
  return el('div', { class: 'tablo__school' }, [
    список('Герои недели', школа.неделя, (с) => с.weekXp, 'На этой неделе баллов пока никто не набрал'),
    список('Больше всех за всё время', школа.всегда, (с) => с.xp, 'Баллов пока ни у кого нет'),
  ]);
}

function список(заголовок, строки, значение, пусто) {
  return el('div', { class: 'tablo__block' }, [
    el('h2', { class: 'tablo__head' }, заголовок),
    строки.length
      ? el('ol', { class: 'tablo__list' }, строки.map((с, i) => строкаТабло(с, i, значение(с))))
      : el('p', { class: 'tablo__empty' }, пусто),
  ]);
}

function строкаТабло(с, место, баллы) {
  return el('li', { class: 'tablo__row' }, [
    el('span', { class: 'tablo__place' }, String(место + 1)),
    el('span', { class: 'tablo__name' }, с.имя),
    с.класс ? el('span', { class: 'tablo__class' }, с.класс) : null,
    el('span', { class: 'tablo__xp' }, String(баллы)),
  ]);
}

function карточкаКласса(класс) {
  return el('div', { class: 'tablo__class-card' }, [
    el('h2', { class: 'tablo__head' }, класс.title),
    el('p', { class: 'tablo__count' },
      класс.цель
        ? `Класс прошёл ${класс.пройдено} из ${класс.цель}`
        : `Учеников: ${класс.учеников}`),
    класс.цель ? полоса(класс.процент) : null,
    класс.неделя.length
      ? el('ol', { class: 'tablo__list tablo__list--small' },
          класс.неделя.map((с, i) => строкаТабло({ ...с, класс: '' }, i, с.weekXp)))
      : el('p', { class: 'tablo__empty' }, 'На этой неделе баллов ещё нет'),
  ]);
}
