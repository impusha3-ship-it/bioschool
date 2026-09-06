import { el } from '../ui/dom.js';
import { полоса } from '../ui/bar.js';
import { loadCourse } from '../content.js';
import { progress } from '../progress/index.js';
import { xpУрока } from '../progress/core.js';

/**
 * Сколько уроков раздела пройдено. Чистая функция: состояние приходит
 * готовым, в файлы уроков никто не лезет — их тридцать четыре, и качать их
 * ради счётчика было бы дорого.
 */
export function прогрессРаздела(раздел, состояние) {
  const уроки = раздел.lessons ?? [];
  const пройдено = уроки.filter((у) => состояние?.lessons?.[у.id]?.done).length;
  return {
    пройдено,
    всего: уроки.length,
    // Пустой раздел бывает: программа расписана вперёд, уроки ещё пишутся.
    процент: уроки.length ? Math.round((пройдено / уроки.length) * 100) : 0,
  };
}

/** То же по всему классу. Уроки чужих классов в счёт не идут: их тут просто нет. */
export function прогрессКурса(курс, состояние) {
  const итог = (курс.sections ?? []).reduce(
    (сумма, раздел) => {
      const п = прогрессРаздела(раздел, состояние);
      return { пройдено: сумма.пройдено + п.пройдено, всего: сумма.всего + п.всего };
    },
    { пройдено: 0, всего: 0 },
  );
  return { ...итог, процент: итог.всего ? Math.round((итог.пройдено / итог.всего) * 100) : 0 };
}

export async function renderClassPage({ grade }) {
  let course;
  try {
    course = await loadCourse(grade);
  } catch (error) {
    return el('section', { class: 'error' }, [
      el('h1', {}, 'Класс не найден'),
      el('p', {}, error.message),
      el('a', { class: 'button', href: '#/' }, 'На главную'),
    ]);
  }

  const состояние = progress.read();
  const общий = прогрессКурса(course, состояние);

  return el('section', { class: 'course' }, [
    el('a', { class: 'back-link', href: '#/' }, '← Все классы'),
    el('h1', { class: 'course__title' }, course.title),
    course.subtitle ? el('p', { class: 'course__sub' }, course.subtitle) : null,
    общий.всего ? шапкаПрогресса(общий) : null,
    el(
      'div',
      { class: 'course__sections' },
      course.sections.map((section) => renderSection(section, состояние)),
    ),
  ]);
}

/**
 * Строка прогресса по всему классу. Стоит сразу под названием: открывая
 * список из тридцати четырёх уроков, ученик первым делом хочет знать, где
 * он в нём находится, а не искать это по галочкам вдоль всего списка.
 */
function шапкаПрогресса(общий) {
  return el('div', { class: 'course__progress' }, [
    el('p', { class: 'course__progress-count' },
      общий.пройдено
        ? `Пройдено ${общий.пройдено} из ${общий.всего}`
        : `Уроков в классе: ${общий.всего}`),
    // Пустая полоса выглядит заполненной: дорожка на бумаге читается как
    // сама полоса, и «пройдено ноль» превращается в «пройдено всё». Пока
    // нечего показывать, полосы нет.
    общий.пройдено ? полоса(общий.процент) : null,
  ]);
}

function renderSection(section, состояние) {
  // Заголовки берём из файла курса, а не скачиваем каждый урок ради названия.
  const items = section.lessons.map((entry, i) => {
    const урок = состояние.lessons?.[entry.id];

    // Нажимается вся строка, а не одно название: попасть пальцем в слово
    // посреди строки на телефоне труднее, чем в саму строку.
    return el('li', {}, [
      el(
        'a',
        {
          class: `lesson-row${урок?.done ? ' lesson-row--done' : ''}`,
          href: `#/lesson/${entry.id}`,
        },
        [
          // Номер внутри раздела: по нему можно договориться с учителем,
          // не пересказывая название.
          el('span', { class: 'lesson-row__num' }, String(i + 1)),
          el('span', { class: 'lesson-row__title' }, [
            entry.title,
            // Пометка о лабораторной стоит в файле курса, а не вычисляется
            // из урока: иначе ради шести значков пришлось бы скачать все
            // тридцать четыре. Тест следит, чтобы она не разошлась с уроками.
            entry.lab ? el('span', { class: 'lesson-lab' }, '(+ лабораторная)') : null,
          ]),
          метка(урок),
        ],
      ),
    ]);
  });

  return секция(section, items, прогрессРаздела(section, состояние));
}

/**
 * Отметка о состоянии урока. Нужна затем, чтобы в списке из тридцати четырёх
 * одинаковых строк было видно, куда идти дальше: до этого пройденный урок и
 * нетронутый выглядели одинаково.
 *
 * Рядом с галочкой стоят набранные баллы — но без «из скольких возможных»:
 * сколько урок может дать, знает только сам файл урока, а качать все ради
 * этой цифры дорого. Обещать точное «40 из 55» и ошибиться хуже, чем честно
 * показать взятое.
 */
function метка(урок) {
  if (!урок) return null;
  const xp = xpУрока(урок);
  const баллы = xp ? el('span', { class: 'lesson-xp' }, `${xp}`) : null;

  if (урок.done) {
    return el('span', { class: 'lesson-state' }, [
      el('span', { class: 'lesson-mark lesson-mark--done', title: 'Пройден' }, '✓'),
      баллы,
    ]);
  }
  return el('span', { class: 'lesson-state' }, [
    el('span', { class: 'lesson-mark lesson-mark--started', title: 'Начат' }, '·'),
    баллы,
  ]);
}

function секция(section, items, прогресс) {
  return el('div', { class: 'section' }, [
    // Часы стоят в одной строке с названием, а не под ним: это уточнение к
    // названию, и отдельной строки оно не заслуживает.
    el('div', { class: 'section__head' }, [
      el('h2', { class: 'section__title' }, section.title),
      el('p', { class: 'section__hours' }, `${section.hours} ч`),
    ]),
    // Пока не пройдено ничего, счёт молчит — как и шапка класса. Встречать
    // новичка нулём незачем: он и так знает, что ещё ничего не сделал.
    прогресс?.пройдено
      ? el('p', { class: 'section__progress' }, `Пройдено ${прогресс.пройдено} из ${прогресс.всего}`)
      : null,
    items.length
      ? el('ul', { class: 'section__lessons' }, items)
      : el('p', { class: 'empty' }, 'Уроки этого раздела ещё готовятся.'),
  ]);
}
