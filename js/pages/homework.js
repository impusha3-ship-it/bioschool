import { el, clear } from '../ui/dom.js';
import { createGame } from '../games/index.js';
import { createHomework, ВХОД_УСТАРЕЛ } from '../homework/submit.js';
import { запомнитьВозврат, сохранитьЧерновик, прочитатьЧерновик, стеретьЧерновик } from '../auth/vozvrat.js';
import { scoreQuestions, openQuestions, isAuto, checkAnswer, combineScore, grade } from '../homework/questions.js';
import { questionField } from '../homework/fields.js';
import { auth } from './login.js';
import { progress } from '../progress/index.js';
import { показать } from '../ui/toast.js';
import { loadPerestanovki } from '../content.js';
import { нуженПеревод, перевестиОтветы } from '../homework/poryadok.js';
import { процентРаботы } from '../homework/pochyot.js';

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

/**
 * Сданная работа с ответами в нынешнем порядке вариантов. Если таблица
 * перестановок не открылась, разбор не показывается вовсе: неверный разбор
 * хуже отсутствующего — ребёнок ему поверит.
 */
async function вТекущемПорядке(работа, lessonId) {
  if (!нуженПеревод(работа)) return работа;
  try {
    const таблица = await loadPerestanovki();
    return { ...работа, answers: перевестиОтветы(работа, lessonId, таблица) };
  } catch {
    const { answers, ...безОтветов } = работа;
    return безОтветов;
  }
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
    if (error.code === ВХОД_УСТАРЕЛ) {
      блок.append(el('div', { class: 'empty' }, [
        el('p', {}, 'Вход на этом устройстве больше не действует: под твоим именем входили на другом.'),
        el('p', {}, 'Войди заново — и задание откроется здесь.'),
        кнопкаВходаЗаново(),
      ]));
      return;
    }
    блок.append(el('p', { class: 'empty' }, `Не удалось проверить задание: ${error.message}`));
    return;
  }

  clear(блок);

  if (сданное) return блок.append(показатьСданное(await вТекущемПорядке(сданное, lesson.id), lesson));
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

/**
 * Сданная работа: сколько получилось и где именно ошибся.
 *
 * Разбор показывается сразу после сдачи, а не когда-нибудь потом. Ошибка,
 * о которой не сказали, ничему не учит: до этого ученик видел одно число
 * процентов и не знал, какие из десяти вопросов он завалил, — а переписать
 * работу нельзя, значит, единственная польза от неё и есть разбор.
 *
 * Показывать ключ здесь не опасно: сдать второй раз не даст база, а не
 * интерфейс. Чужую работу так тоже не подсмотреть — разбор строится из того,
 * что сдал сам ученик, и лежит за его входом.
 */
function показатьСданное(работа, lesson = null) {
  const дата = new Date(работа.submittedAt).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  const строки = [el('p', { class: 'homework__done-title' }, 'Работа сдана')];

  // Баллов может не быть: работа могла прийти из старой версии или из проверки.
  // Показывать «undefined из undefined» хуже, чем не показывать ничего.
  //
  // Процент — с баллом учителя за развёрнутый ответ, тем же счётом, что в
  // журнале и в почёте. Пока ответ не проверен, так и сказано: процент
  // временный и после проверки изменится.
  if (Number.isFinite(работа.total) && работа.total > 0) {
    const итог = процентРаботы(работа);
    const хвост = итог?.ждёт
      ? ' — пока без развёрнутого ответа, его проверит учитель'
      : итог?.развёрнутая
        ? ` — вместе с оценкой учителя за развёрнутый ответ: ${итог.развёрнутая.получено} из ${итог.развёрнутая.из}`
        : '';
    строки.push(
      el('p', { class: 'homework__done-score' },
        `Верно ${работа.correct ?? 0} из ${работа.total}. Итог: ${итог?.процент ?? работа.percent ?? 0}%${хвост}`),
    );
  }

  строки.push(el('p', { class: 'homework__done-when' }, дата + (работа.isLate ? ', с опозданием' : '')));

  const разбор = собратьРазбор(работа, lesson);

  // Без разбора судьба развёрнутого ответа говорится здесь: работам, сданным
  // до появления разбора, ответы по вопросам не сохранялись, и показать их
  // рядом с вопросом уже неоткуда.
  if (!разбор) {
    if (работа.open && Object.keys(работа.open).length && работа.manualScore === undefined) {
      строки.push(el('p', { class: 'homework__await' }, 'Развёрнутый ответ ждёт проверки учителя.'));
    }
    if (работа.manualScore !== undefined) {
      строки.push(
        el('p', { class: 'homework__manual' }, `Учитель поставил за развёрнутый ответ: ${работа.manualScore}`),
      );
    }
    if (работа.comment) строки.push(el('p', { class: 'homework__comment' }, работа.comment));
  }

  строки.push(
    el('p', { class: 'homework__hint' }, 'Переписать работу нельзя, но потренироваться можно сколько угодно.'),
  );

  return el('div', { class: 'homework__done' }, [
    el('div', { class: 'homework__done-head' }, строки),
    разбор,
  ].filter(Boolean));
}

/**
 * Разбор сданной работы: каждый вопрос с ответом ученика и вердиктом.
 *
 * Развёрнутому ответу вердикта не ставится и ключ ему не показывается: его
 * судит человек, и до того, как учитель прочитал, никакого «верно» тут нет.
 * Вместо вердикта — судьба проверки: ждёт или уже разобран, и с чем.
 */
export function собратьРазбор(работа, lesson, { document: doc = globalThis.document } = {}) {
  if (!lesson || !работа?.answers) return null;

  const вопросы = собратьВопросы(lesson);
  if (!вопросы.length) return null;

  const e = (tag, attrs, children) => el(tag, attrs, children, { document: doc });
  const ответы = { ...работа.answers, ...(работа.open ?? {}) };
  const части = [e('h2', {}, 'Разбор')];

  for (const q of вопросы) {
    const поле = questionField(q, { ...ответы }, { disabled: true, document: doc });
    части.push(поле.element);

    if (isAuto(q)) {
      поле.showResult(checkAnswer(q, ответы[q.id]).ok);
      continue;
    }

    поле.showNote(
      ...(работа.manualScore === undefined
        ? [
            e('p', { class: 'q__verdict-line' }, 'Ждёт проверки учителя'),
            e('p', { class: 'q__verdict-text' },
              'Когда учитель проверит, на сайте появится уведомление с баллом.'),
          ]
        : [
            e('p', { class: 'q__verdict-line' },
              `Учитель поставил: ${работа.manualScore}${q.maxScore ? ` из ${q.maxScore}` : ''}`),
            работа.comment ? e('p', { class: 'q__verdict-text' }, работа.comment) : null,
          ]),
    );
  }

  /*
    Игра в разбор не попадает: в работу уходит только её счёт, а какие ходы
    ученик сделал, нигде не сохранено. Без этой строчки счёт «7 из 10» над
    шестью разобранными вопросами читался бы как пропажа четырёх.
  */
  const конфигИгры = Array.isArray(lesson.game) ? lesson.game[0] : lesson.game;
  if (конфигИгры) {
    части.push(
      e('p', { class: 'homework__hint' },
        'В счёт вошла ещё игра — её разбор не сохраняется, но пройти её заново можно на вкладке «Тренажёр».'),
    );
  }

  return e('div', { class: 'homework__review' }, части);
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

  // Черновик остаётся, если ученик уходил войти заново посреди работы.
  const ответы = прочитатьЧерновик(lesson.id) ?? {};
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
        classId: сессия.classId,
        lessonId: lesson.id,
        token: await auth.token(),
        gameResult: игра ? игра.getResult() : null,
        questionResult: scoreQuestions(вопросы, ответы),
        answers: собратьОтветы(вопросы, ответы),
        open: открытыеОтветы,
        dueAt: назначение.dueAt,
      });
      стеретьЧерновик(lesson.id);
      clear(блок);
      блок.append(показатьСданное(работа, lesson));
      window.scrollTo(0, 0);

      // Баллы считаются по той же работе, что ушла в журнал, но журнала не
      // касаются: отметку ставит учитель, а это отдельный слой поверх. Сдача
      // уже состоялась, поэтому отказ начисления не должен её отменять.
      try {
        показать(await progress.record({
          lessonId: lesson.id,
          kind: 'homework',
          percent: работа.percent,
          состав: [],
        }));
      } catch {
        // Работа сдана, а баллы догонят: перенос при следующем запуске сольёт.
      }
      // Почёт — по сданной работе: только что сданная должна попасть туда сразу.
      progress.обновитьДомашние();
    } catch (error) {
      ошибка.textContent = error.message;
      кнопка.removeAttribute('disabled');
      кнопка.textContent = 'Сдать работу';
      if (error.code === ВХОД_УСТАРЕЛ) {
        // Игру после входа придётся пройти заново: её ходы не хранятся.
        сохранитьЧерновик(lesson.id, ответы);
        ошибка.append(' ', кнопкаВходаЗаново());
      }
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

/**
 * «Войти заново»: выход, запомненный адрес и страница входа. Новый вход
 * перепишет привязку на это устройство, и сдача пройдёт.
 *
 * Прогресс в браузере здесь, в отличие от «Выйти», не стирается: пока вход
 * был устаревшим, он не мог уйти в базу, и стирание его потеряло бы. Чужим
 * он не достанется — у записи есть хозяин, и читать её может только он.
 */
function кнопкаВходаЗаново() {
  const кнопка = el('button', { class: 'button', type: 'button' }, 'Войти заново');
  кнопка.addEventListener('click', () => {
    запомнитьВозврат(location.hash);
    auth.logout();
    location.hash = '#/login';
    location.reload();
  });
  return кнопка;
}
