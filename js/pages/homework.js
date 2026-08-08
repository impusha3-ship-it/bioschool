import { el, clear } from '../ui/dom.js';
import { createGame } from '../games/index.js';
import { createHomework } from '../homework/submit.js';
import { scoreQuestions, openQuestions, isAuto, combineScore, grade } from '../homework/questions.js';
import { auth } from './login.js';

const hw = createHomework();

/**
 * Вкладка «Домашнее задание».
 *
 * Отличается от тренажёра тем, что результат уходит в журнал, и уходит
 * ровно один раз. Поэтому здесь всё построено вокруг одной кнопки и
 * честного предупреждения перед ней.
 */
export function renderHomework(lesson) {
  const сессия = auth.current();

  if (!сессия || сессия.kind !== 'student') {
    return el('div', { class: 'empty' }, [
      el('p', {}, 'Чтобы сдать домашнее задание, нужно войти.'),
      el('a', { class: 'button', href: '#/login' }, 'Войти'),
    ]);
  }

  const блок = el('div', { class: 'homework' }, [el('p', { class: 'loading' }, 'Проверяю, задано ли…')]);
  подготовить(блок, lesson, сессия);
  return блок;
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
  // Развёрнутые лежат отдельным списком, чтобы их было видно в файле урока,
  // но дальше работают наравне с остальными.
  const вопросы = [
    ...(lesson.homework?.questions ?? []),
    ...(lesson.homework?.open ?? []).map((q) => ({ ...q, type: 'open' })),
  ];
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
    части.push(вопросВБлок(q, ответы));
  }

  for (const q of открытые) {
    части.push(развёрнутыйВопрос(q, ответы));
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

function вопросВБлок(q, ответы) {
  const поля = [];

  if (q.type === 'choice' || q.type === 'multi') {
    q.options.forEach((текст, index) => {
      const вход = el('input', {
        type: q.type === 'choice' ? 'radio' : 'checkbox',
        name: q.id,
        id: `${q.id}-${index}`,
        class: 'q__input',
      });
      вход.addEventListener('change', () => {
        if (q.type === 'choice') {
          ответы[q.id] = index;
        } else {
          const набор = new Set(ответы[q.id] ?? []);
          вход.checked ? набор.add(index) : набор.delete(index);
          ответы[q.id] = [...набор];
        }
      });
      поля.push(
        el('label', { class: 'q__option', for: `${q.id}-${index}` }, [вход, el('span', {}, текст)]),
      );
    });
  } else {
    const поле = el('input', { class: 'q__short', type: 'text', 'aria-label': 'Ответ' });
    поле.addEventListener('input', () => { ответы[q.id] = поле.value; });
    поля.push(поле);
  }

  return el('div', { class: 'q' }, [
    q.exam ? el('span', { class: 'q__exam' }, q.exam) : null,
    el('p', { class: 'q__text' }, q.text),
    el('div', { class: 'q__body' }, поля),
  ]);
}

function развёрнутыйВопрос(q, ответы) {
  const поле = el('textarea', { class: 'q__open', rows: '6', 'aria-label': 'Развёрнутый ответ' });
  поле.addEventListener('input', () => { ответы[q.id] = поле.value; });

  return el('div', { class: 'q q--open' }, [
    el('span', { class: 'q__exam' }, 'Проверяет учитель'),
    el('p', { class: 'q__text' }, q.prompt),
    q.hint ? el('p', { class: 'q__hint' }, q.hint) : null,
    поле,
  ]);
}

export { combineScore, grade };
