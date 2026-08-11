import { el, clear } from '../ui/dom.js';
import { createGame } from '../games/index.js';
import { createHomework } from '../homework/submit.js';
import { scoreQuestions, openQuestions, isAuto, combineScore, grade } from '../homework/questions.js';
import { questionField } from '../homework/fields.js';
import { auth } from './login.js';

const hw = createHomework();

/**
 * Вкладка «Домашнее задание».
 *
 * Отличается от тренажёра тем, что результат уходит в журнал, и уходит
 * ровно один раз. Поэтому здесь всё построено вокруг одной кнопки и
 * честного предупреждения перед ней.
 *
 * Сдавать может только ученик, которому урок задан. Но **смотреть** задание
 * должны все: учителю его надо вычитать перед тем, как задавать, а до этого
 * вкладка не показывала ничего, кроме предложения войти. Отсюда режим
 * просмотра — то же задание, но поля отключены, а учителю ещё и виден ключ.
 */
export function renderHomework(lesson) {
  const сессия = auth.current();

  if (сессия?.kind === 'student') {
    const блок = el('div', { class: 'homework' }, [el('p', { class: 'loading' }, 'Проверяю, задано ли…')]);
    подготовить(блок, lesson, сессия);
    return блок;
  }

  return показатьПросмотр(lesson, сессия?.kind === 'teacher');
}

async function подготовить(блок, lesson, сессия) {
  let назначение;
  let сданное;
  try {
    const token = await auth.token();
    const [назначения, работы] = await Promise.all([
      hw.loadAssignments(сессия.classId),
      hw.loadSubmissions(сессия.studentId, token),
    ]);
    назначение = назначения?.[lesson.id];
    сданное = работы?.[lesson.id];
  } catch (error) {
    clear(блок);
    блок.append(el('p', { class: 'empty' }, `Не удалось проверить задание: ${error.message}`));
    return;
  }

  clear(блок);

  if (сданное) return блок.append(показатьСданное(сданное));
  if (!назначение?.isOpen) {
    return блок.append(
      el('div', { class: 'empty' }, [
        el('p', {}, 'Этот урок пока не задан.'),
        el('p', {}, 'Можно потренироваться на вкладке «Тренажёр» — результат никуда не пойдёт.'),
      ]),
    );
  }

  блок.append(собратьРаботу(lesson, сессия, назначение, блок));
}

/**
 * Просмотр задания: видно всё, отправить нельзя.
 *
 * Учителю показывается ключ — иначе вычитывать двести вопросов пришлось бы,
 * сверяясь с файлом урока. Гостю ключ не показывается: страница открыта всем,
 * и ученик, вышедший из своей учётной записи, попадает именно сюда.
 */
function показатьПросмотр(lesson, учитель) {
  const вопросы = собратьВопросы(lesson);

  if (!вопросы.length) {
    return el('div', { class: 'empty' }, [el('p', {}, 'К этому уроку домашнее задание ещё не составлено.')]);
  }

  const части = [
    el('div', { class: учитель ? 'preview-note preview-note--key' : 'preview-note' }, [
      el('p', { class: 'preview-note__title' }, учитель ? 'Просмотр с ключом' : 'Просмотр задания'),
      el(
        'p',
        {},
        учитель
          ? 'Так задание выглядит у ученика. Верные варианты отмечены — ученику их не видно. Сдать работу отсюда нельзя.'
          : 'Так выглядит домашнее задание этого урока. Чтобы его сдать, нужно войти под своим именем — задание откроется, когда учитель задаст урок классу.',
      ),
    ]),
  ];

  const конфигИгры = Array.isArray(lesson.game) ? lesson.game[0] : lesson.game;
  if (конфигИгры) {
    let игра = null;
    try {
      игра = createGame(конфигИгры);
    } catch {
      игра = null;
    }
    if (игра) части.push(el('h2', {}, 'Задание'), игра.element);
  }

  for (const q of вопросы) {
    части.push(questionField(q, {}, { disabled: true, key: учитель }).element);
  }

  if (!учитель) {
    части.push(
      el('div', { class: 'homework__submit' }, [
        el('a', { class: 'button', href: '#/login' }, 'Войти, чтобы сдать'),
      ]),
    );
  }

  return el('div', { class: 'homework homework--preview' }, части);
}

/**
 * Развёрнутые лежат в файле урока отдельным списком, чтобы их было видно
 * глазом, но дальше работают наравне с остальными.
 */
function собратьВопросы(lesson) {
  return [
    ...(lesson.homework?.questions ?? []),
    ...(lesson.homework?.open ?? []).map((q) => ({ ...q, type: 'open' })),
  ];
}

function показатьСданное(работа) {
  const дата = new Date(работа.submittedAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  const строки = [el('p', { class: 'homework__done-title' }, 'Работа сдана')];

  // Баллов может не быть: работа могла прийти из старой версии или из проверки.
  // Показывать «undefined из undefined» хуже, чем не показывать ничего.
  if (Number.isFinite(работа.total) && работа.total > 0) {
    строки.push(
      el('p', { class: 'homework__done-score' },
        `${работа.correct ?? 0} из ${работа.total} — ${работа.percent ?? 0}%`),
    );
  }

  строки.push(el('p', { class: 'homework__done-when' }, дата + (работа.isLate ? ', с опозданием' : '')));

  if (работа.open && Object.keys(работа.open).length) {
    строки.push(
      el('p', { class: 'homework__await' }, 'Развёрнутый ответ ждёт проверки учителя.'),
    );
  }
  if (работа.manualScore !== undefined) {
    строки.push(el('p', { class: 'homework__manual' }, `Учитель поставил за развёрнутый ответ: ${работа.manualScore}`));
  }
  if (работа.comment) {
    строки.push(el('p', { class: 'homework__comment' }, работа.comment));
  }

  строки.push(
    el('p', { class: 'homework__hint' }, 'Переписать работу нельзя, но потренироваться можно сколько угодно.'),
  );

  return el('div', { class: 'homework__done' }, строки);
}

function собратьРаботу(lesson, сессия, назначение, блок) {
  const вопросы = собратьВопросы(lesson);
  const открытые = openQuestions(вопросы);
  const конфигИгры = Array.isArray(lesson.game) ? lesson.game[0] : lesson.game;

  let игра = null;
  if (конфигИгры) {
    try {
      игра = createGame(конфигИгры);
    } catch {
      игра = null;
    }
  }

  const ответы = {};
  const части = [];

  if (назначение.dueAt) {
    const срок = new Date(назначение.dueAt);
    const опоздал = Date.now() > назначение.dueAt;
    части.push(
      el('p', { class: опоздал ? 'homework__due homework__due--late' : 'homework__due' },
        опоздал
          ? `Срок был ${срок.toLocaleDateString('ru-RU')} — сдать всё ещё можно, но будет отмечено опоздание`
          : `Сдать до ${срок.toLocaleDateString('ru-RU')}`),
    );
  }

  if (игра) {
    части.push(el('h2', {}, 'Задание'), игра.element);
  }

  for (const q of вопросы.filter(isAuto)) {
    части.push(questionField(q, ответы).element);
  }

  for (const q of открытые) {
    части.push(questionField(q, ответы).element);
  }

  const ошибка = el('p', { class: 'homework__error' });
  const кнопка = el('button', { class: 'button', type: 'button' }, 'Сдать работу');

  кнопка.addEventListener('click', async () => {
    ошибка.textContent = '';
    кнопка.setAttribute('disabled', 'true');
    кнопка.textContent = 'Отправляю…';

    try {
      const открытыеОтветы = {};
      for (const q of открытые) открытыеОтветы[q.id] = String(ответы[q.id] ?? '').trim();

      const работа = await hw.submit({
        studentId: сессия.studentId,
        lessonId: lesson.id,
        token: await auth.token(),
        gameResult: игра ? игра.getResult() : null,
        questionResult: scoreQuestions(вопросы, ответы),
        answers: собратьОтветы(вопросы, ответы),
        open: открытыеОтветы,
        dueAt: назначение.dueAt,
      });
      clear(блок);
      блок.append(показатьСданное(работа));
      window.scrollTo(0, 0);
    } catch (error) {
      ошибка.textContent = error.message;
      кнопка.removeAttribute('disabled');
      кнопка.textContent = 'Сдать работу';
    }
  });

  части.push(
    el('div', { class: 'homework__submit' }, [
      el('p', { class: 'homework__warn' }, 'Сдать можно один раз — результат пойдёт в журнал. Проверь ответы.'),
      кнопка,
      ошибка,
    ]),
  );

  return el('div', {}, части);
}

function собратьОтветы(вопросы, ответы) {
  const out = {};
  for (const q of вопросы.filter(isAuto)) out[q.id] = ответы[q.id] ?? null;
  return out;
}

export { combineScore, grade };
