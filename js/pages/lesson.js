import { el } from '../ui/dom.js';
import { loadLesson } from '../content.js';
import { loadFigure, parseSvg } from '../ui/figure.js';
import { createGame } from '../games/index.js';
import { renderHomework } from './homework.js';

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
  if (tab === 'practice') return renderPractice(lesson.game);
  if (tab === 'homework') return renderHomework(lesson);
  return renderComingSoon(TAB_TITLES[tab]);
}

function renderSummary(summary) {
  return el('div', { class: 'summary' }, [
    ...summary.blocks.map((block) => renderBlock(block)),
    summary.terms?.length ? renderTerms(summary.terms) : null,
    renderKeyPoints(summary.key_points),
  ]);
}

export function renderBlock(block, { document: doc = globalThis.document } = {}) {
  const e = (tag, attrs, children) => el(tag, attrs, children, { document: doc });

  if (block.type === 'figure') {
    return renderFigure(block, e);
  }
  if (block.type === 'lab') {
    return renderLab(block, e);
  }
  if (block.type === 'list') {
    return e('div', { class: 'block' }, [
      block.heading ? e('h2', {}, block.heading) : null,
      e('ul', { class: 'block__list' }, block.items.map((item) => e('li', {}, item))),
    ]);
  }
  return e('div', { class: 'block' }, [
    block.heading ? e('h2', {}, block.heading) : null,
    e('p', {}, block.body),
  ]);
}

/*
  Механики `lab` пока нет, поэтому лабораторная живёт текстом: оборудование,
  ход работы, что записать. Метка о будущем интерактиве задана здесь, а не в
  файлах уроков: лабораторных в 5 классе семь, и одинаковая фраза, размноженная
  по семи файлам, вычищалась бы тоже из семи. Появится механика — уйдёт отсюда.
*/
const LAB_PENDING = 'Интерактивная версия появится позже — пока работа выполняется в кабинете.';

function renderLab(block, e) {
  return e('div', { class: 'lab' }, [
    block.kind ? e('p', { class: 'lab__kind' }, block.kind) : null,
    e('h2', { class: 'lab__title' }, block.title),
    block.goal ? e('p', { class: 'lab__goal' }, block.goal) : null,
    block.equipment?.length
      ? e('div', { class: 'lab__equipment' }, [
          e('h3', {}, 'Что понадобится'),
          e('ul', {}, block.equipment.map((item) => e('li', {}, item))),
        ])
      : null,
    e('div', { class: 'lab__steps' }, [
      e('h3', {}, 'Ход работы'),
      e('ol', {}, block.steps.map((step) => e('li', {}, step))),
    ]),
    block.conclusion ? e('p', { class: 'lab__conclusion' }, block.conclusion) : null,
    e('p', { class: 'lab__pending' }, LAB_PENDING),
  ]);
}

/**
 * Схема грузится асинхронно и вставляется в уже отрисованную рамку.
 * Подпись появляется сразу и остаётся, даже если файл не загрузился, —
 * тогда ученик хотя бы прочитает, о чём была картинка.
 */
function renderFigure(block, e) {
  const holder = e('div', { class: 'figure__holder' });

  loadFigure(block.src)
    .then((text) => {
      const svg = parseSvg(text);
      if (!svg) return;
      svg.setAttribute('class', 'figure__svg');
      holder.append(svg);
    })
    .catch(() => {
      holder.append(e('p', { class: 'figure__missing' }, 'Схема не загрузилась.'));
    });

  return e('figure', { class: 'figure' }, [
    holder,
    block.caption ? e('figcaption', { class: 'figure__caption' }, block.caption) : null,
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
    el(
      'ol',
      { class: 'keypoints__list' },
      points.map((p) => el('li', { class: 'reveal' }, p)),
    ),
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

/**
 * Свободный режим: играть можно сколько угодно, результат никуда не идёт.
 * Нужен, чтобы ученик познакомился с механикой до оцениваемой попытки
 * и не терял баллы из-за незнакомого интерфейса.
 */
function renderPractice(config) {
  // В уроке может быть одно задание или несколько подряд.
  const configs = Array.isArray(config) ? config : config ? [config] : [];

  if (!configs.length) {
    return el('div', { class: 'empty' }, [
      el('p', {}, 'К этому уроку тренажёр ещё не готов.'),
    ]);
  }

  return el(
    'div',
    { class: 'practice' },
    configs.map((one, index) => renderExercise(one, index, configs.length)),
  );
}

function renderExercise(config, index, total) {
  let game;
  try {
    game = createGame(config);
  } catch (error) {
    return el('div', { class: 'empty' }, [
      el('p', {}, 'Задание не запустилось.'),
      el('p', {}, error.message),
    ]);
  }

  const score = el('p', { class: 'game__score' });
  const again = el('button', { class: 'button button--quiet', type: 'button' }, 'Начать заново');
  again.addEventListener('click', () => game.reset());

  function updateScore() {
    const { correct, total: всего } = game.getResult();
    if (!game.isComplete()) {
      score.textContent = `Разобрано ${correct} из ${всего}`;
      score.className = 'game__score';
      return;
    }
    score.textContent =
      correct === всего
        ? `Всё верно: ${correct} из ${всего}`
        : `Верно ${correct} из ${всего} — попробуй ещё раз`;
    score.className = correct === всего ? 'game__score game__score--win' : 'game__score game__score--miss';
  }

  game.onChange(updateScore);
  updateScore();

  return el('section', { class: 'exercise' }, [
    total > 1 ? el('p', { class: 'exercise__num' }, `Задание ${index + 1} из ${total}`) : null,
    game.element,
    config.afterword ? el('p', { class: 'exercise__afterword' }, config.afterword) : null,
    el('div', { class: 'practice__footer' }, [score, again]),
  ]);
}

function renderComingSoon(title) {
  return el('div', { class: 'empty' }, [
    el('p', {}, `${title} появится на следующем этапе разработки.`),
    el('p', {}, 'Пока доступны конспект и материалы урока.'),
  ]);
}
