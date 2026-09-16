import { el, clear } from '../ui/dom.js';
import { auth } from './login.js';
import {
  createTeacherData,
  собратьЖурнал,
  урокиПроверки,
  работыСРазвёрнутым,
  СТАТУСЫ,
} from '../teacher/data.js';
import { loadLesson, loadCourse } from '../content.js';
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

  // Почёт сверяется со сданными работами молча, в фоне: сбой здесь не повод
  // закрывать учителю журнал, а при следующем входе сверка повторится.
  data.свестиПочёт(всё).catch(() => {});

  clear(тело);
  const перезагрузить = ({ тихо = false } = {}) => {
    if (тихо) return;
    наполнить(тело, view);
  };

  if (view === 'check') тело.append(показатьПроверку(всё));
  else if (view === 'classes') тело.append(показатьКлассы(всё, перезагрузить));
  else if (view === 'assign') тело.append(показатьНазначение(всё, перезагрузить));
  else if (view === 'progress') тело.append(показатьПрогресс(всё, { загрузитьПрогресс: data.прогрессУченика }));
  else тело.append(показатьЖурнал(всё, перезагрузить));
}

// ── Журнал ───────────────────────────────────────────────────

function показатьЖурнал(всё, перезагрузить) {
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

      /*
        Клетка со сданной работой нажимается: оттуда учитель разрешает
        переписать. Подтверждение показывается не в клетке, а полосой под
        таблицей — в клетку шириной в два символа не поместить ни имени
        ученика, ни предупреждения о том, что работа исчезнет.
      */
      const полоса = el('div', { class: 'jredo' });

      const спросить = (ученик, клетка, номер) => {
        clear(полоса);
        const да = el('button', { class: 'button button--danger', type: 'button' }, 'Дать переписать');
        const отмена = el('button', { class: 'button button--quiet', type: 'button' }, 'Отмена');
        const состояние = el('span', { class: 'tstudents__error' });

        отмена.addEventListener('click', () => clear(полоса));
        да.addEventListener('click', async () => {
          да.setAttribute('disabled', 'true');
          состояние.textContent = 'Открываю…';
          try {
            await data.разрешитьПереписать({ studentId: ученик.id, lessonId: клетка.lessonId });
            перезагрузить();
          } catch (error) {
            состояние.textContent = error.message;
            да.removeAttribute('disabled');
          }
        });

        полоса.append(
          el('p', { class: 'jredo__warn' },
            `Дать ${ученик.name} переписать урок ${номер} (${клетка.lessonId})? ` +
            'Прежняя работа и оценка за неё исчезнут — сохранить их негде, ' +
            'иначе ученик не сможет сдать заново. Урок должен оставаться заданным.'),
          да,
          отмена,
          состояние,
        );
      };

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
                  ...с.клетки.map((к, i) => {
                    const подпись = к.percent === null ? '' : `${к.percent}%`;
                    const клетка = el('td', { class: КЛАСС_КЛЕТКИ[к.статус] ?? 'cell', title: к.статус });
                    if (!к.работа) {
                      клетка.append(подпись);
                      return клетка;
                    }
                    const кнопка = el('button', {
                      class: 'journal__redo',
                      type: 'button',
                      title: `${к.статус} — нажми, чтобы дать переписать`,
                    }, подпись || '·');
                    кнопка.addEventListener('click', () => спросить(с, к, i + 1));
                    клетка.append(кнопка);
                    return клетка;
                  }),
                ]),
              ),
            ),
          ]),
        ]),
        полоса,
        el('ol', { class: 'jlegend' }, уроки.map((у, i) => el('li', {}, `${i + 1} — ${у.lessonId}`))),
      ]);
    }),
  );
}

// ── Проверка развёрнутых ответов ─────────────────────────────

/**
 * Вкладка «Проверка»: сначала выбирается урок, потом разбираются работы.
 *
 * Раньше здесь лежала общая очередь непроверенного, и работа исчезала из неё
 * навсегда, едва по ней нажали балл. Промахнуться кнопкой можно за полсекунды,
 * а исправить было нечем: проверенного панель больше не показывала. Поэтому
 * единица работы теперь урок — в нём видны все, и разобранные тоже, и балл у
 * любого нажимается заново.
 *
 * Выбор урока нужен и сам по себе: тридцать работ подряд из разных уроков
 * читаются хуже, чем тридцать ответов на один и тот же вопрос, — критерий
 * держится в голове один, и оценки выходят сравнимыми.
 */
function показатьПроверку(всё) {
  const блок = el('div', { class: 'check' }, [el('p', { class: 'loading' }, 'Собираю развёрнутые ответы…')]);
  собратьПроверку(блок, всё);
  return блок;
}

async function собратьПроверку(блок, всё) {
  const уроки = урокиПроверки(всё);

  clear(блок);

  if (!уроки.length) {
    блок.append(el('p', { class: 'empty' }, 'Развёрнутых ответов пока никто не присылал.'));
    return;
  }

  const названия = await названияУроков(уроки);

  const сводка = el('p', { class: 'check__count' });
  const выбор = el('select', { class: 'login__field', 'aria-label': 'Урок' });
  const холст = el('div', { class: 'check__list' });

  for (const у of уроки) выбор.append(el('option', { value: у.lessonId }, ''));

  /**
   * Счётчики стоят прямо в подписях выбора и пересчитываются после каждой
   * проверки: иначе выбор до перезагрузки говорил бы, что работы ещё ждут,
   * хотя учитель их только что разобрал.
   */
  function пересчитать() {
    const свежие = урокиПроверки(всё);
    const ждут = свежие.reduce((n, у) => n + у.ждут, 0);
    сводка.textContent = ждут
      ? `Ждут проверки: ${ждут}`
      : 'Всё разобрано. Балл можно переставить у любой работы.';

    выбор.querySelectorAll('option').forEach((option) => {
      const у = свежие.find((с) => с.lessonId === option.value);
      const имя = названия.get(option.value) ?? option.value;
      option.textContent = у?.ждут ? `${имя} — ждут ${у.ждут}` : `${имя} — разобрано`;
    });
  }

  выбор.addEventListener('change', () => показатьУрок(холст, всё, выбор.value, пересчитать));
  пересчитать();

  блок.append(
    сводка,
    el('div', { class: 'tblock' }, [el('h2', {}, 'Какой урок проверяем'), выбор]),
    холст,
  );

  показатьУрок(холст, всё, выбор.value, пересчитать);
}

/**
 * Названия уроков берутся из курсов, а не из файлов уроков: курсов пять, а
 * уроков сорок, и выбор не должен ждать сорока запросов ради подписей.
 */
async function названияУроков(уроки) {
  const нужные = new Set(уроки.map((у) => у.lessonId.split('-')[0]));
  const названия = new Map();

  for (const grade of нужные) {
    try {
      const курс = await loadCourse(grade);
      for (const раздел of курс.sections) {
        for (const урок of раздел.lessons) названия.set(урок.id, урок.title);
      }
    } catch {
      // Курс не открылся — в выборе останется идентификатор урока. Это хуже
      // названия, но работать не мешает.
    }
  }

  return названия;
}

async function показатьУрок(холст, всё, lessonId, пересчитать) {
  clear(холст);
  холст.append(el('p', { class: 'loading' }, 'Загружаю задание…'));

  /*
    Задание урока грузится ради двух вещей: вопроса, на который отвечал
    ученик, и цены ответа в баллах. Цена — не украшение: у тридцати пяти
    уроков развёрнутое задание стоит три балла, а кнопок в панели было три
    штуки, 0-1-2, и поставить высший балл было физически нечем.
  */
  let задания = new Map();
  let макс = 3;
  let бедаСУроком = false;
  try {
    const урок = await loadLesson(lessonId);
    const открытые = урок.homework?.open ?? [];
    for (const q of открытые) задания.set(q.id, q);
    макс = Math.max(...открытые.map((q) => Number(q.maxScore) || 0), 0) || 3;
  } catch {
    бедаСУроком = true;
  }

  const работы = работыСРазвёрнутым(всё, { lessonId });

  clear(холст);
  if (бедаСУроком) {
    холст.append(
      el('p', { class: 'check__warn' },
        'Задание урока не загрузилось — вопрос и цена в баллах неизвестны, кнопки показаны до трёх.'),
    );
  }
  холст.append(...работы.map((р) => карточкаРаботы(р, { задания, макс, всё, пересчитать })));
}

function карточкаРаботы(запись, { задания, макс, всё, пересчитать }) {
  const комментарий = el('input', {
    class: 'login__field',
    type: 'text',
    placeholder: 'Комментарий ученику (не обязательно)',
    'aria-label': 'Комментарий',
  });
  комментарий.value = запись.comment ?? '';

  const состояние = el('p', { class: 'check__state' });
  const карточка = el('div', { class: 'check__card' });

  let текущий = запись.manualScore;

  function отрисоватьСостояние() {
    карточка.className = текущий === undefined ? 'check__card' : 'check__card check__card--done';
    состояние.textContent =
      текущий === undefined ? 'Ждёт проверки' : `Поставлено: ${текущий} из ${макс}`;
    состояние.className = текущий === undefined ? 'check__state' : 'check__state check__state--set';
    for (const к of кнопки) {
      const свой = Number(к.dataset.score) === текущий;
      к.className = свой ? 'check__score check__score--active' : 'check__score';
      к.setAttribute('aria-pressed', свой ? 'true' : 'false');
    }
  }

  /*
    Кнопки после сохранения остаются живыми — в этом всё дело: балл жмут ещё
    раз, если ошиблись. Заперта кнопка только пока идёт запись, чтобы два
    балла не ушли вперегонки.
  */
  const кнопки = Array.from({ length: макс + 1 }, (_, балл) => {
    const b = el('button', { class: 'check__score', type: 'button' }, String(балл));
    b.dataset.score = String(балл);
    b.addEventListener('click', async () => {
      const прежний = текущий;
      for (const к of кнопки) к.setAttribute('disabled', 'true');
      состояние.textContent = 'Сохраняю…';
      try {
        const данные = await data.поставитьБалл({
          studentId: запись.studentId,
          lessonId: запись.lessonId,
          score: балл,
          comment: комментарий.value.trim(),
        });
        текущий = балл;
        // Загруженный снимок обновляется на месте: перезагружать всю панель
        // ради одной клетки дорого, а счётчики должны сойтись сразу.
        const работа = всё.submissions?.[запись.studentId]?.[запись.lessonId];
        if (работа) {
          работа.manualScore = балл;
          работа.checkedAt = данные.checkedAt;
          работа.comment = данные.comment ?? undefined;
        }
        отрисоватьСостояние();
        пересчитать();
      } catch (error) {
        текущий = прежний;
        отрисоватьСостояние();
        состояние.textContent = error.message;
      } finally {
        for (const к of кнопки) к.removeAttribute('disabled');
      }
    });
    return b;
  });

  карточка.append(
    el('p', { class: 'check__who' }, запись.имя),
    ...запись.ответы.flatMap((о) => {
      const задание = задания.get(о.questionId);
      return [
        задание ? el('p', { class: 'check__prompt' }, задание.prompt ?? задание.text) : null,
        el('p', { class: 'check__answer' }, о.текст),
      ].filter(Boolean);
    }),
    комментарий,
    el('div', { class: 'check__scores' }, [el('span', { class: 'check__label' }, 'Балл:'), ...кнопки]),
    состояние,
  );

  отрисоватьСостояние();
  return карточка;
}
