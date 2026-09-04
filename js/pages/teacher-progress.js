import { el, clear } from '../ui/dom.js';
import { ступень } from '../progress/core.js';
import { loadCourse } from '../content.js';
import { баллов } from '../ui/sklonenie.js';

/** Две недели без единого захода — повод спросить, что случилось. */
export const ДАВНО_НЕ_БЫЛ_МС = 14 * 86400000;

/**
 * Собирает таблицу прогресса класса.
 *
 * Чистая функция: получает уже загруженные данные и ничего не запрашивает —
 * иначе её не проверить без сети.
 *
 * Ученики без единой записи в таблице тоже в списке, нулём. Именно они и есть
 * тот сигнал, ради которого вкладка заведена: пропавшего видно только тогда,
 * когда его строка на месте.
 */
export function собратьПрогресс({ classId, students = {}, leaderboard = {}, сейчас = Date.now() }) {
  const строки = Object.entries(students)
    .filter(([, у]) => у.classId === classId)
    .map(([id, у]) => {
      const запись = leaderboard[id] ?? {};
      const xp = запись.xp ?? 0;
      return {
        id,
        имя: у.name,
        xp,
        ступень: ступень(xp).имя,
        уроков: запись.lessonsDone ?? 0,
        заНеделю: запись.weekXp ?? 0,
        последний: запись.lastSeen ?? null,
        давноНеБыл: !запись.lastSeen || сейчас - запись.lastSeen > ДАВНО_НЕ_БЫЛ_МС,
      };
    })
    .sort((a, b) => a.имя.localeCompare(b.имя, 'ru'));

  return { строки };
}

const ВИДЫ = {
  lab: 'Лабораторная',
  vpr: 'Тренажёр ВПР',
  homework: 'Домашняя работа',
};

/** Название вида работы для человека. Незнакомое показывается как есть. */
export function названиеВида(ключ) {
  if (/^game\d+$/.test(ключ)) return 'Игра';
  if (/^key\d+$/.test(ключ)) return 'Определитель';
  return ВИДЫ[ключ] ?? ключ;
}

/**
 * Разбор баллов ученика по урокам.
 *
 * Уроки чужих классов вынесены отдельно ради вопроса, который этот экран и
 * породил: откуда у ученика триста баллов, если по своему классу он прошёл
 * два урока. Ответ виден, только когда чужое не смешано со своим — а зайти
 * в любой урок любого класса на сайте может кто угодно, и баллы за игру и
 * тренажёр начисляются везде одинаково.
 *
 * Класс урока берётся из начала его идентификатора: «5-griby» — пятый.
 * Так же он определяется на странице прогресса ученика.
 */
export function разборУченика({ состояние = {}, курсы = {}, grade }) {
  const свои = [];
  const чужие = [];

  for (const [id, урок] of Object.entries(состояние.lessons ?? {})) {
    const виды = Object.entries(урок)
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .map(([k, v]) => ({ имя: названиеВида(k), xp: v }));
    const класс = id.split('-')[0];
    const запись = {
      id,
      grade: класс,
      title: названиеУрока(курсы[класс], id) ?? id,
      xp: виды.reduce((n, в) => n + в.xp, 0),
      виды,
    };
    (String(класс) === String(grade) ? свои : чужие).push(запись);
  }

  const поУбыванию = (а, б) => б.xp - а.xp;
  свои.sort(поУбыванию);
  чужие.sort(поУбыванию);

  return {
    всего: [...свои, ...чужие].reduce((n, у) => n + у.xp, 0),
    свои,
    чужие,
  };
}

function названиеУрока(курс, id) {
  for (const раздел of курс?.sections ?? []) {
    const урок = (раздел.lessons ?? []).find((у) => у.id === id);
    if (урок) return урок.title;
  }
  return null;
}

/**
 * Таблица по каждому классу. Сортировка по фамилии, а не по баллам: список
 * учеников учитель читает глазами по алфавиту, а рейтинг ему тут не нужен.
 *
 * Фамилия нажимается — под таблицей раскрывается разбор баллов этого ученика.
 */
export function показатьПрогресс({ classes = {}, students = {}, leaderboards = {} }, { загрузитьПрогресс } = {}) {
  const списки = Object.entries(classes);
  if (!списки.length) return el('div', { class: 'empty' }, [el('p', {}, 'Классов пока нет.')]);

  return el(
    'div',
    { class: 'teacher-progress' },
    списки.map(([classId, класс]) => {
      const { строки } = собратьПрогресс({
        classId,
        students,
        leaderboard: leaderboards[classId] ?? {},
      });

      // Разбор раскрывается под таблицей, а не вместо неё: учителю нужно
      // видеть, из какой строки он пришёл, и сравнивать с соседями.
      const разбор = el('div', { class: 'razbor' });

      return el('div', { class: 'teacher-progress__class' }, [
        el('h2', {}, класс.title ?? classId),
        строки.length
          ? таблица(строки, (с) => показатьРазбор(разбор, с, класс.grade, загрузитьПрогресс))
          : el('p', { class: 'empty' }, 'В этом классе пока нет учеников.'),
        разбор,
      ]);
    }),
  );
}

function таблица(строки, открыть) {
  return el('table', { class: 'journal' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, 'Ученик'),
        el('th', {}, 'Ступень'),
        el('th', {}, 'Баллы'),
        el('th', {}, 'За неделю'),
        el('th', {}, 'Уроков'),
        el('th', {}, 'Последний заход'),
      ]),
    ]),
    el(
      'tbody',
      {},
      строки.map((с) =>
        el('tr', { class: с.давноНеБыл ? 'row--stale' : null }, [
          el('td', {}, [фамилия(с, открыть)]),
          el('td', {}, с.ступень),
          el('td', {}, String(с.xp)),
          el('td', {}, String(с.заНеделю)),
          el('td', {}, String(с.уроков)),
          el('td', {}, с.последний ? new Date(с.последний).toLocaleDateString('ru-RU') : 'ни разу'),
        ]),
      ),
    ),
  ]);
}

/** Фамилия в таблице: кнопка, если разбор вообще можно загрузить. */
function фамилия(с, открыть) {
  if (!открыть) return el('span', {}, с.имя);
  const кнопка = el('button', { class: 'razbor__open', type: 'button' }, с.имя);
  кнопка.addEventListener('click', () => открыть(с));
  return кнопка;
}

/**
 * Раскрывает разбор баллов ученика. Курсы качаются по тем классам, уроки
 * которых у него встречаются, — иначе названий уроков взять неоткуда, а
 * тянуть все пять курсов ради одной фамилии незачем.
 */
async function показатьРазбор(узел, с, grade, загрузитьПрогресс) {
  clear(узел);
  узел.append(el('p', { class: 'loading' }, `Смотрю, из чего сложились баллы: ${с.имя}…`));

  let состояние;
  try {
    состояние = await загрузитьПрогресс(с.id);
  } catch (error) {
    clear(узел);
    узел.append(el('p', { class: 'login__error' }, error.message));
    return;
  }

  const классы = new Set(
    Object.keys(состояние.lessons ?? {}).map((id) => id.split('-')[0]).filter((г) => /^[5-9]$/.test(г)),
  );
  const курсы = {};
  for (const г of классы) {
    try {
      курсы[г] = await loadCourse(г);
    } catch {
      // Без курса урок покажется идентификатором — это лучше, чем пустой экран.
    }
  }

  const р = разборУченика({ состояние, курсы, grade });
  clear(узел);

  const закрыть = el('button', { class: 'button button--quiet', type: 'button' }, 'Свернуть');
  закрыть.addEventListener('click', () => clear(узел));

  узел.append(
    el('h3', { class: 'razbor__head' }, `${с.имя} — ${р.всего} ${баллов(р.всего)}`),
    р.всего
      ? el('div', {}, [
          группа(`Уроки ${grade} класса`, р.свои, 'По своему классу баллов пока нет'),
          группа('Уроки других классов', р.чужие, null),
        ])
      : el('p', { class: 'empty' }, 'Баллов пока нет вовсе.'),
    закрыть,
  );
}

function группа(заголовок, уроки, пусто) {
  if (!уроки.length && !пусто) return null;
  return el('div', { class: 'razbor__group' }, [
    el('h4', { class: 'razbor__sub' }, `${заголовок}${уроки.length ? ` — ${сумма(уроки)}` : ''}`),
    уроки.length
      ? el('ul', { class: 'razbor__list' }, уроки.map(строкаУрока))
      : el('p', { class: 'empty' }, пусто),
  ]);
}

function сумма(уроки) {
  return уроки.reduce((n, у) => n + у.xp, 0);
}

function строкаУрока(у) {
  return el('li', { class: 'razbor__row' }, [
    el('span', { class: 'razbor__lesson' }, у.title),
    el('span', { class: 'razbor__kinds' }, у.виды.map((в) => `${в.имя} ${в.xp}`).join(' · ')),
    el('span', { class: 'razbor__xp' }, String(у.xp)),
  ]);
}
