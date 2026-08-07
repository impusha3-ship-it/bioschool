import { el } from '../ui/dom.js';
import { loadLesson } from '../content.js';

const TAB_TITLES = {
  summary: 'Конспект',
  practice: 'Тренажёр',
  homework: 'Домашнее задание',
  materials: 'Материалы',
};

export async function renderLessonPage({ lessonId, tab }) {
  let lesson;
  try {
    lesson = await loadLesson(lessonId);
  } catch (error) {
    return el('section', { class: 'error' }, [
      el('h1', {}, 'Урок не открывается'),
      el('p', {}, error.message),
      el('a', { class: 'button', href: '#/' }, 'На главную'),
    ]);
  }

  return el('section', { class: 'lesson' }, [
    el('a', { class: 'back-link', href: `#/class/${lesson.grade}` }, `← ${lesson.grade} класс`),
    el('h1', { class: 'lesson__title' }, lesson.title),
    renderTabs(lesson, tab),
    renderTabBody(lesson, tab),
  ]);
}

function renderTabs(lesson, active) {
  return el(
    'nav',
    { class: 'tabs', 'aria-label': 'Разделы урока' },
    Object.entries(TAB_TITLES).map(([id, title]) =>
      el(
        'a',
        {
          class: id === active ? 'tabs__item tabs__item--active' : 'tabs__item',
          href: `#/lesson/${lesson.id}/${id}`,
          'aria-current': id === active ? 'page' : null,
        },
        title,
      ),
    ),
  );
}

function renderTabBody(lesson, tab) {
  if (tab === 'summary') return renderSummary(lesson.summary);
  if (tab === 'materials') return renderMaterials(lesson.materials ?? []);
  return renderComingSoon(TAB_TITLES[tab]);
}

function renderSummary(summary) {
  return el('div', { class: 'summary' }, [
    ...summary.blocks.map(renderBlock),
    summary.terms?.length ? renderTerms(summary.terms) : null,
    renderKeyPoints(summary.key_points),
  ]);
}

function renderBlock(block) {
  if (block.type === 'list') {
    return el('div', { class: 'block' }, [
      block.heading ? el('h2', {}, block.heading) : null,
      el('ul', { class: 'block__list' }, block.items.map((item) => el('li', {}, item))),
    ]);
  }
  return el('div', { class: 'block' }, [
    block.heading ? el('h2', {}, block.heading) : null,
    el('p', {}, block.body),
  ]);
}

function renderTerms(terms) {
  return el('div', { class: 'terms' }, [
    el('h2', {}, 'Термины'),
    el(
      'dl',
      { class: 'terms__list' },
      terms.flatMap((t) => [el('dt', {}, t.term), el('dd', {}, t.definition)]),
    ),
  ]);
}

function renderKeyPoints(points) {
  return el('div', { class: 'keypoints' }, [
    el('h2', {}, 'Главное за 30 секунд'),
    el('ol', { class: 'keypoints__list' }, points.map((p) => el('li', {}, p))),
  ]);
}

function renderMaterials(materials) {
  if (!materials.length) {
    return el('p', { class: 'empty' }, 'К этому уроку пока не добавлены дополнительные материалы.');
  }
  return el(
    'ul',
    { class: 'materials' },
    materials.map((m) =>
      el('li', {}, [el('a', { href: m.url, target: '_blank', rel: 'noopener' }, m.title)]),
    ),
  );
}

function renderComingSoon(title) {
  return el('div', { class: 'empty' }, [
    el('p', {}, `${title} появится на следующем этапе разработки.`),
    el('p', {}, 'Пока доступны конспект и материалы урока.'),
  ]);
}
