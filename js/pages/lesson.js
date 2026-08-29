import { el } from '../ui/dom.js';
import { loadLesson } from '../content.js';
import { loadFigure, parseSvg } from '../ui/figure.js';
import { createGame } from '../games/index.js';
import { createQuiz } from '../homework/quiz.js';
import { renderHomework } from './homework.js';
import { progress } from '../progress/index.js';
import { показать } from '../ui/toast.js';

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

/**
 * Виды работы, которые в этом уроке есть. По ним ставится признак
 * пройденности: страница урок уже открыла и знает его состав, а список из
 * тридцати четырёх уроков — нет, и качать их все ради галочек незачем.
 */
function составУрока(lesson) {
  const игры = Array.isArray(lesson.game) ? lesson.game : lesson.game ? [lesson.game] : [];
  const состав = игры.map((игра, i) => ключИгры(игра, i));
  if ((lesson.vpr ?? []).length) состав.push('vpr');
  return состав;
}

/** Определители пишутся своим ключом: по нему потом виден значок «Ботаник». */
function ключИгры(config, index) {
  return `${config?.type === 'key' ? 'key' : 'game'}${index}`;
}

/** Начисляет и показывает плашку. Отказ здесь не должен ломать урок. */
async function зачесть(событие) {
  try {
    показать(await progress.record(событие));
  } catch {
    // Игра пройдена, и это главное. Баллы догонят при следующем прохождении.
  }
}

function renderTabBody(lesson, tab) {
  if (tab === 'summary') return renderSummary(lesson.summary, lesson);
  if (tab === 'materials') return renderMaterials(lesson.materials ?? []);
  if (tab === 'practice') return renderPractice(lesson);
  if (tab === 'homework') return renderHomework(lesson);
  return renderComingSoon(TAB_TITLES[tab]);
}

function renderSummary(summary, lesson = null) {
  return el('div', { class: 'summary' }, [
    ...summary.blocks.map((block) => renderBlock(block, { lesson })),
    summary.terms?.length ? renderTerms(summary.terms) : null,
    renderKeyPoints(summary.key_points),
  ]);
}

// Урок приходит в мешке настроек, а не отдельным доводом: без него разметка
// собирается ровно как прежде, и старые вызовы с двумя доводами (в том числе
// в тестах) остаются годными. Нужен он только лабораторной — чтобы было куда
// начислить баллы.
export function renderBlock(block, { document: doc = globalThis.document, lesson = null } = {}) {
  const e = (tag, attrs, children) => el(tag, attrs, children, { document: doc });

  if (block.type === 'figure') {
    return renderFigure(block, e);
  }
  if (block.type === 'lab') {
    return renderLab(block, e, doc, lesson);
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
  Метка для работ, у которых интерактивной версии ещё нет. Задана здесь, а не в
  файлах уроков: одинаковая фраза, размноженная по файлам, вычищалась бы тоже
  из каждого. У работы с блоком `run` её нет — там вместо неё сама работа.
*/
const LAB_PENDING = 'Интерактивная версия появится позже — пока работа выполняется в кабинете.';

/**
 * Лабораторная работа.
 *
 * Текстовая часть остаётся всегда: по ней работу делают в кабинете, если до
 * кабинета дошло. Интерактивная — под ней, и она же обычно единственная:
 * практические вживую проводятся редко, и сайт для большинства учеников —
 * то место, где они увидят, чем работа кончается.
 */
function renderLab(block, e, doc, lesson = null) {
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
    block.run ? renderLabRun(block.run, e, doc, lesson) : e('p', { class: 'lab__pending' }, LAB_PENDING),
  ]);
}

function renderLabRun(run, e, doc, lesson = null) {
  let игра;
  try {
    игра = createGame({ ...run, type: 'lab' }, { document: doc });
  } catch {
    // Работу не собрали — текстовая часть выше всё равно на месте, и по ней
    // работа выполнима. Молча показываем прежнюю метку, а не пустое место.
    return e('p', { class: 'lab__pending' }, LAB_PENDING);
  }

  // Баллы начисляются один раз на доведённую до конца работу, а не на каждый
  // шаг. Флаг снимается только вместе с работой: пройденная заново начисто
  // должна догнать добавку за безошибочность.
  if (lesson) {
    let начислено = false;
    игра.onChange(() => {
      if (!игра.isComplete() || начислено) return;
      начислено = true;
      const { correct, total } = игра.getResult();
      зачесть({ lessonId: lesson.id, kind: 'lab', correct, total, состав: составУрока(lesson) });
    });
  }

  return e('div', { class: 'lab__run' }, [
    e('h3', {}, 'Провести работу здесь'),
    игра.element,
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
 * Свободный режим: играть можно сколько угодно, и **в журнал это не идёт**.
 * Нужен, чтобы ученик познакомился с механикой до оцениваемой попытки
 * и не терял баллы из-за незнакомого интерфейса.
 *
 * С появлением геймификации отсюда начисляются баллы прогресса — но это
 * другой слой: оценку ставит учитель по сданной работе, а баллы к ней не
 * имеют отношения и ошибиться здесь по-прежнему ничего не стоит.
 */
function renderPractice(lesson) {
  // В уроке может быть одно задание или несколько подряд.
  const config = lesson.game;
  const configs = Array.isArray(config) ? config : config ? [config] : [];
  const впр = lesson.vpr ?? [];

  if (!configs.length && !впр.length) {
    return el('div', { class: 'empty' }, [
      el('p', {}, 'К этому уроку тренажёр ещё не готов.'),
    ]);
  }

  return el('div', { class: 'practice' }, [
    ...configs.map((one, index) => renderExercise(one, index, configs.length, lesson)),
    впр.length ? renderVpr(впр, configs.length > 0, lesson) : null,
  ]);
}

/**
 * Блок заданий в формате ВПР.
 *
 * Формулировки и способ ответа взяты из проверочной работы, а не придуманы
 * заново: ученик, впервые увидевший «запишите ответ в виде числа» на самой
 * работе, теряет баллы не на биологии, а на непривычной формулировке. Здесь
 * ошибиться бесплатно и сразу видно, почему.
 */
function renderVpr(вопросы, естьИгра, lesson = null) {
  const quiz = createQuiz(вопросы, {
    onChecked: lesson
      ? ({ correct, total }) =>
          зачесть({ lessonId: lesson.id, kind: 'vpr', correct, total, состав: составУрока(lesson) })
      : null,
  });

  return el('section', { class: естьИгра ? 'exercise exercise--vpr' : 'exercise' }, [
    el('p', { class: 'exercise__num' }, 'Задания в формате ВПР'),
    el(
      'p',
      { class: 'exercise__lead' },
      'Такие задания встретятся на проверочной работе. Здесь они ничего не стоят: ответил — сразу видно, верно или нет и почему.',
    ),
    quiz.element,
  ]);
}

function renderExercise(config, index, total, lesson = null) {
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

  // Начисляем один раз на завершённое задание, а не на каждое движение.
  // Флаг снимается вместе с игрой: пройденная заново начисто должна догнать
  // добавку за безошибочность, иначе выгодно бросить задание, где ошибся.
  let начислено = false;
  again.addEventListener('click', () => {
    начислено = false;
    game.reset();
  });

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

    if (lesson && !начислено) {
      начислено = true;
      зачесть({
        lessonId: lesson.id,
        kind: ключИгры(config, index),
        correct,
        total: всего,
        состав: составУрока(lesson),
      });
    }
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
