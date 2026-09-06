import { el } from '../ui/dom.js';
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
 * что и так есть в имени. Курсы здесь не скачиваются намеренно — главная
 * должна открываться сразу, а ради счётчика пришлось бы ждать пять файлов.
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

export async function renderHomePage() {
  const пройдено = пройденоПоКлассам(progress.read());

  return el('section', { class: 'home' }, [
    el('div', { class: 'home__hero' }, [
      el('h1', { class: 'home__title' }, 'Биология'),
      el(
        'p',
        { class: 'home__lead' },
        'Конспект, схема, тренажёр и домашняя работа — на каждый урок программы.',
      ),
    ]),
    el(
      'div',
      { class: 'grades' },
      GRADES.map((g) => карточка(g, пройдено[String(g.grade)] ?? 0)),
    ),
  ]);
}

function карточка(g, сделано) {
  return el('a', { class: 'grade-card', 'data-grade': String(g.grade), href: `#/class/${g.grade}` }, [
    el('span', { class: 'grade-card__num', 'aria-hidden': 'true' }, String(g.grade)),
    el('span', { class: 'grade-card__title' }, g.title),
    el('span', { class: 'grade-card__sub' }, g.subtitle),
    // Счёт появляется только когда есть что показать: встречать новичка
    // нулём незачем — он и так знает, что ещё ничего не сделал.
    сделано ? el('span', { class: 'grade-card__done' }, `Пройдено ${сделано}`) : null,
  ]);
}
