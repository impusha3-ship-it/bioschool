import { el, clear } from '../ui/dom.js';
import { auth } from './login.js';
import { createTeacherData, собратьЖурнал, очередьПроверки, СТАТУСЫ } from '../teacher/data.js';
import { показатьКлассы, показатьНазначение } from './teacher-classes.js';
import { показатьПрогресс } from './teacher-progress.js';

const data = createTeacherData({ getToken: () => auth.token() });

const КЛАСС_КЛЕТКИ = {
  [СТАТУСЫ.НЕ_СДАНО]: 'cell cell--none',
  [СТАТУСЫ.ЖДЁТ]: 'cell cell--await',
  [СТАТУСЫ.С_ОПОЗДАНИЕМ]: 'cell cell--late',
  [СТАТУСЫ.СДАНО]: 'cell cell--done',
};

export async function renderTeacherPage({ view = 'journal' } = {}) {
  const сессия = auth.current();
  if (сессия?.kind !== 'teacher') {
    return el('section', {}, [
      el('h1', {}, 'Только для учителя'),
      el('p', {}, 'Войди по почте и паролю.'),
      el('a', { class: 'button', href: '#/teacher-login' }, 'Вход для учителя'),
    ]);
  }

  const тело = el('div', {}, [el('p', { class: 'loading' }, 'Загружаю журнал…')]);
  наполнить(тело, view);

  return el('section', { class: 'teacher' }, [
    el('h1', {}, 'Панель учителя'),
    el('nav', { class: 'tabs', 'aria-label': 'Разделы панели' }, [
      вкладка('journal', 'Журнал', view),
      вкладка('check', 'Проверка', view),
      вкладка('classes', 'Классы', view),
      вкладка('assign', 'Задать урок', view),
      вкладка('progress', 'Прогресс', view),
    ]),
    тело,
  ]);
}

function вкладка(id, подпись, активная) {
  return el(
    'a',
    {
      class: id === активная ? 'tabs__item tabs__item--active' : 'tabs__item',
      href: id === 'journal' ? '#/teacher' : `#/teacher/${id}`,
      'aria-current': id === активная ? 'page' : null,
    },
    подпись,
  );
}

async function наполнить(тело, view) {
  let всё;
  try {
    всё = await data.загрузитьВсё();
  } catch (error) {
    clear(тело);
    тело.append(el('p', { class: 'login__error' }, error.message));
    return;
  }

  clear(тело);
  const перезагрузить = ({ тихо = false } = {}) => {
    if (тихо) return;
    наполнить(тело, view);
  };

  if (view === 'check') тело.append(показатьПроверку(всё, тело, view));
  else if (view === 'classes') тело.append(показатьКлассы(всё, перезагрузить));
  else if (view === 'assign') тело.append(показатьНазначение(всё, перезагрузить));
  else if (view === 'progress') тело.append(показатьПрогресс(всё));
  else тело.append(показатьЖурнал(всё));
}

// ── Журнал ───────────────────────────────────────────────────

function показатьЖурнал(всё) {
  const классы = Object.entries(всё.classes);
  if (!классы.length) {
    return el('div', { class: 'empty' }, [el('p', {}, 'Классов пока нет.')]);
  }

  return el(
    'div',
    {},
    классы.map(([classId, класс]) => {
      const { уроки, строки } = собратьЖурнал({ classId, ...всё });

      if (!уроки.length) {
        return el('div', { class: 'jclass' }, [
          el('h2', {}, класс.title),
          el('p', { class: 'empty' }, 'Этому классу пока ничего не задано.'),
        ]);
      }

      return el('div', { class: 'jclass' }, [
        el('h2', {}, класс.title),
        el('p', { class: 'jclass__sub' }, `${строки.length} учеников, задано уроков: ${уроки.length}`),
        // Таблица шире экрана телефона — прокручивается внутри себя,
        // чтобы не растягивать страницу.
        el('div', { class: 'jscroll' }, [
          el('table', { class: 'journal' }, [
            el('thead', {}, [
              el('tr', {}, [
                el('th', { class: 'journal__name' }, 'Ученик'),
                ...уроки.map((у, i) =>
                  el('th', { class: 'journal__lesson', title: у.lessonId }, String(i + 1)),
                ),
              ]),
            ]),
            el(
              'tbody',
              {},
              строки.map((с) =>
                el('tr', {}, [
                  el('td', { class: 'journal__name' }, с.name),
                  ...с.клетки.map((к) =>
                    el('td', { class: КЛАСС_КЛЕТКИ[к.статус] ?? 'cell', title: к.статус },
                      к.percent === null ? '' : `${к.percent}%`),
                  ),
                ]),
              ),
            ),
          ]),
        ]),
        el('ol', { class: 'jlegend' }, уроки.map((у, i) => el('li', {}, `${i + 1} — ${у.lessonId}`))),
      ]);
    }),
  );
}

// ── Проверка развёрнутых ответов ─────────────────────────────

function показатьПроверку(всё, тело, view) {
  const очередь = очередьПроверки(всё);

  if (!очередь.length) {
    return el('div', { class: 'empty' }, [
      el('p', {}, 'Проверять нечего — все развёрнутые ответы разобраны.'),
    ]);
  }

  return el('div', { class: 'check' }, [
    el('p', { class: 'check__count' }, `Ждут проверки: ${очередь.length}`),
    ...очередь.map((з) => карточкаОтвета(з, тело, view)),
  ]);
}

function карточкаОтвета(запись, тело, view) {
  const комментарий = el('input', {
    class: 'login__field',
    type: 'text',
    placeholder: 'Комментарий ученику (не обязательно)',
    'aria-label': 'Комментарий',
  });

  const состояние = el('p', { class: 'check__state' });
  const карточка = el('div', { class: 'check__card' });

  const кнопки = [0, 1, 2].map((балл) => {
    const b = el('button', { class: 'check__score', type: 'button' }, String(балл));
    b.addEventListener('click', async () => {
      for (const к of кнопки) к.setAttribute('disabled', 'true');
      состояние.textContent = 'Сохраняю…';
      try {
        await data.поставитьБалл({
          studentId: запись.studentId,
          lessonId: запись.lessonId,
          score: балл,
          comment: комментарий.value.trim(),
        });
        карточка.className = 'check__card check__card--done';
        состояние.textContent = `Поставлено: ${балл}`;
      } catch (error) {
        состояние.textContent = error.message;
        for (const к of кнопки) к.removeAttribute('disabled');
      }
    });
    return b;
  });

  карточка.append(
    el('p', { class: 'check__who' }, `${запись.имя} — ${запись.lessonId}`),
    el('p', { class: 'check__answer' }, запись.текст),
    комментарий,
    el('div', { class: 'check__scores' }, [el('span', { class: 'check__label' }, 'Балл:'), ...кнопки]),
    состояние,
  );

  return карточка;
}
