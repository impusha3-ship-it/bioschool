import { el } from '../ui/dom.js';
import { уроков } from '../ui/sklonenie.js';
import { loadKlassy } from '../content.js';
import { progress } from '../progress/index.js';

const GRADES = [
  { grade: 5, title: '5 класс', subtitle: 'Введение в биологию' },
  { grade: 6, title: '6 класс', subtitle: 'Растительный организм' },
  { grade: 7, title: '7 класс', subtitle: 'Систематика растений, грибы, бактерии' },
  { grade: 8, title: '8 класс', subtitle: 'Животные' },
  { grade: 9, title: '9 класс', subtitle: 'Человек' },
];

/**
 * Сколько уроков каждого класса уже пройдено.
 *
 * Класс берётся из начала идентификатора урока («5-griby» — пятый), как и на
 * странице прогресса: держать это отдельным полем значило бы дублировать то,
 * что и так есть в имени.
 */
export function пройденоПоКлассам(состояние) {
  const счёт = {};
  for (const [id, урок] of Object.entries(состояние?.lessons ?? {})) {
    if (!урок?.done) continue;
    const класс = id.split('-')[0];
    if (!/^[5-9]$/.test(класс)) continue;
    счёт[класс] = (счёт[класс] ?? 0) + 1;
  }
  return счёт;
}

/**
 * Итог по всем классам одной строкой.
 *
 * «На сайте» — это то, что правда лежит на сайте, а не то, что есть в
 * программе: обещать сто семьдесят уроков и отдать сорок девять нельзя.
 */
export function строкаИтога(готовые, всегоКлассов = GRADES.length) {
  const всего = готовые.reduce((с, к) => с + к.уроков, 0);
  if (!всего) return '';

  const годы = готовые.map((к) => к.класс).join(', ');
  // «Остальные годы пишутся» — только если они правда есть. Когда написано
  // всё, эта оговорка врала бы.
  const хвост = готовые.length < всегоКлассов ? ' Остальные годы пишутся.' : '';

  return готовые.length === 1
    ? `Сейчас на сайте ${всего} ${уроков(всего)} — ${годы} класс.${хвост}`
    : `Сейчас на сайте ${всего} ${уроков(всего)}: классы ${годы}.${хвост}`;
}

export async function renderHomePage() {
  const пройдено = пройденоПоКлассам(progress.read());

  /*
    Список классов ждём до отрисовки — намеренно. Файл крошечный, лежит рядом
    и кешируется, зато карточки годов рисуются сразу верными: и «34 урока», и
    «уроки готовятся» стоят с первого кадра, а не приезжают через полсекунды,
    дёргая сетку. Если файл не открылся, показываем все годы ссылками без
    счёта — так было до появления списка, и открыть класс это не мешает.
  */
  let готовые = null;
  try {
    готовые = await loadKlassy();
  } catch {
    готовые = null;
  }

  const счёт = готовые ? new Map(готовые.map((к) => [к.класс, к.уроков])) : null;

  return el('section', { class: 'home' }, [
    el('div', { class: 'masthead' }, [
      el('h1', { class: 'masthead__title' }, 'Биология'),
      el(
        'p',
        { class: 'masthead__lead' },
        'Конспект, схема, тренажёр и домашняя работа — на каждый урок программы ' +
          'с пятого по девятый класс.',
      ),
      готовые ? el('p', { class: 'masthead__count' }, строкаИтога(готовые)) : null,
    ]),
    el(
      'div',
      { class: 'grades' },
      GRADES.map((g) => карточка(g, счёт, пройдено[String(g.grade)] ?? 0)),
    ),
  ]);
}

function карточка(g, счёт, сделано) {
  // Список не открылся — считаем год открытым: не пускать в написанный класс
  // хуже, чем не показать, сколько там уроков.
  const всего = счёт ? (счёт.get(g.grade) ?? 0) : null;

  if (всего === 0) return готовится(g);

  return el(
    'a',
    { class: 'grade-card', 'data-grade': String(g.grade), href: `#/class/${g.grade}` },
    [
      тело(g),
      // Нижней строки нет вовсе, если сказать в ней нечего: пустая строка с
      // отчёркиванием выглядит недогрузившейся.
      всего || сделано
        ? el('span', { class: 'grade-card__meta' }, [
            всего ? el('span', { class: 'grade-card__count' }, `${всего} ${уроков(всего)}`) : null,
            сделано ? el('span', { class: 'grade-card__done' }, `пройдено ${сделано}`) : null,
          ])
        : null,
      кромка(всего, сделано),
    ],
  );
}

/**
 * Год, до которого уроки ещё не написаны. Раньше он был обычной ссылкой и вёл
 * на «Класс не найден» — ученик получал сообщение об ошибке за то, что нажал
 * на показанную ему кнопку.
 */
function готовится(g) {
  return el('div', { class: 'grade-card grade-card--soon', 'data-grade': String(g.grade) }, [
    тело(g),
    el('span', { class: 'grade-card__meta' }, [
      el('span', { class: 'grade-card__count' }, 'уроки готовятся'),
    ]),
  ]);
}

/** Нижняя кромка карточки, заполненная цветом года по мере прохождения. */
function кромка(всего, сделано) {
  if (!всего || !сделано) return null;
  const доля = Math.min(100, Math.round((сделано / всего) * 100));
  const узел = el('span', { class: 'grade-card__fill', 'aria-hidden': 'true' });
  узел.setAttribute('style', `width: ${доля}%`);
  return узел;
}

function тело(g) {
  return el('span', { class: 'grade-card__top' }, [
    el('span', { class: 'grade-card__text' }, [
      el('span', { class: 'grade-card__title' }, g.title),
      el('span', { class: 'grade-card__sub' }, g.subtitle),
    ]),
    el('span', { class: 'grade-card__num', 'aria-hidden': 'true' }, String(g.grade)),
  ]);
}
