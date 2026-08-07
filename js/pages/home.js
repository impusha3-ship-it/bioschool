import { el } from '../ui/dom.js';

const GRADES = [
  { grade: 5, title: '5 класс', subtitle: 'Введение в биологию' },
  { grade: 6, title: '6 класс', subtitle: 'Растительный организм' },
  { grade: 7, title: '7 класс', subtitle: 'Систематика растений, грибы, бактерии' },
  { grade: 8, title: '8 класс', subtitle: 'Животные' },
  { grade: 9, title: '9 класс', subtitle: 'Человек' },
];

export async function renderHomePage() {
  return el('section', { class: 'home' }, [
    el('h1', { class: 'home__title' }, 'Биология'),
    el('p', { class: 'home__lead' }, 'Выбери класс, чтобы открыть уроки.'),
    el(
      'div',
      { class: 'grades' },
      GRADES.map((g) =>
        el('a', { class: 'grade-card', 'data-grade': String(g.grade), href: `#/class/${g.grade}` }, [
          el('span', { class: 'grade-card__num' }, String(g.grade)),
          el('span', { class: 'grade-card__title' }, g.title),
          el('span', { class: 'grade-card__sub' }, g.subtitle),
        ]),
      ),
    ),
  ]);
}
