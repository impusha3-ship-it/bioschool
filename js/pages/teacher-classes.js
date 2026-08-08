import { el, clear } from '../ui/dom.js';
import { auth } from './login.js';
import { createClassAdmin, разобратьСписок } from '../teacher/classes.js';
import { loadCourse } from '../content.js';

const admin = createClassAdmin({ getToken: () => auth.token() });

const КЛАССЫ = ['5', '6', '7', '8', '9'];

/** Экран «Классы»: создать класс, добавить учеников, выдать коды. */
export function показатьКлассы(всё, перезагрузить) {
  const блок = el('div', { class: 'tclasses' });

  блок.append(формаНовогоКласса(перезагрузить));

  const классы = Object.entries(всё.classes);
  if (!классы.length) {
    блок.append(el('p', { class: 'empty' }, 'Классов пока нет — создай первый.'));
    return блок;
  }

  for (const [classId, класс] of классы) {
    const ученики = Object.entries(всё.students)
      .filter(([, s]) => s.classId === classId)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    блок.append(
      el('div', { class: 'jclass' }, [
        el('h2', {}, класс.title),
        el('p', { class: 'jclass__sub' }, `Учеников: ${ученики.length}`),
        списокУчеников(ученики),
        формаДобавления(classId, всё, перезагрузить),
      ]),
    );
  }

  return блок;
}

function списокУчеников(ученики) {
  if (!ученики.length) return el('p', { class: 'empty' }, 'Пока никого.');

  return el(
    'ul',
    { class: 'tstudents' },
    ученики.map((у) => {
      const результат = el('span', { class: 'tstudents__code' });
      const сброс = el('button', { class: 'button button--quiet', type: 'button' }, 'Новый код');

      сброс.addEventListener('click', async () => {
        сброс.setAttribute('disabled', 'true');
        результат.textContent = 'Меняю…';
        try {
          const { код } = await admin.сброситьPin(у.id);
          результат.textContent = `новый код: ${код}`;
          результат.className = 'tstudents__code tstudents__code--new';
        } catch (error) {
          результат.textContent = error.message;
          сброс.removeAttribute('disabled');
        }
      });

      return el('li', { class: 'tstudents__row' }, [
        el('span', { class: 'tstudents__name' }, у.name),
        результат,
        сброс,
      ]);
    }),
  );
}

function формаНовогоКласса(перезагрузить) {
  const название = el('input', { class: 'login__field', type: 'text', placeholder: 'Например, 5А', 'aria-label': 'Название класса' });
  const параллель = el('select', { class: 'login__field', 'aria-label': 'Параллель' });
  for (const г of КЛАССЫ) параллель.append(el('option', { value: г }, `${г} класс`));

  const ошибка = el('p', { class: 'login__error' });
  const кнопка = el('button', { class: 'button', type: 'submit' }, 'Создать класс');
  const форма = el('form', { class: 'tform' }, [название, параллель, кнопка]);

  форма.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = название.value.trim();
    if (!title) { ошибка.textContent = 'Нужно название.'; return; }

    ошибка.textContent = '';
    кнопка.setAttribute('disabled', 'true');
    try {
      await admin.создатьКласс({ title, grade: параллель.value });
      перезагрузить();
    } catch (error) {
      ошибка.textContent = error.message;
      кнопка.removeAttribute('disabled');
    }
  });

  return el('div', { class: 'tblock' }, [el('h2', {}, 'Новый класс'), форма, ошибка]);
}

function формаДобавления(classId, всё, перезагрузить) {
  const поле = el('textarea', {
    class: 'q__open',
    rows: '5',
    placeholder: 'Вставь список фамилий — по одной в строке.\nНумерацию можно не убирать.',
    'aria-label': 'Список учеников',
  });

  const выдача = el('div', { class: 'tcodes' });
  const ошибка = el('p', { class: 'login__error' });
  const кнопка = el('button', { class: 'button', type: 'button' }, 'Добавить и выдать коды');

  кнопка.addEventListener('click', async () => {
    const имена = разобратьСписок(поле.value);
    if (!имена.length) { ошибка.textContent = 'Список пустой.'; return; }

    ошибка.textContent = '';
    кнопка.setAttribute('disabled', 'true');
    кнопка.textContent = 'Завожу…';

    try {
      const занятые = new Set(Object.keys(всё.students));
      const выданные = await admin.добавитьУчеников(classId, имена, занятые);
      clear(выдача);
      выдача.append(таблицаКодов(выданные));
      поле.value = '';
    } catch (error) {
      ошибка.textContent = error.message;
    } finally {
      кнопка.removeAttribute('disabled');
      кнопка.textContent = 'Добавить и выдать коды';
    }
  });

  return el('div', { class: 'tblock' }, [
    el('h3', {}, 'Добавить учеников'),
    поле,
    кнопка,
    ошибка,
    выдача,
  ]);
}

/**
 * Коды показываются один раз и больше нигде не появятся: в базу уходит
 * только хеш. Поэтому здесь громкое предупреждение и кнопка печати.
 */
function таблицаКодов(выданные) {
  const печать = el('button', { class: 'button button--quiet', type: 'button' }, 'Распечатать');
  печать.addEventListener('click', () => window.print());

  return el('div', { class: 'tcodes__box' }, [
    el('p', { class: 'tcodes__warn' }, 'Запиши или распечатай коды сейчас — второй раз их не увидит никто, включая тебя. Забытый код не восстанавливают, а выдают новый.'),
    el(
      'ul',
      { class: 'tcodes__list' },
      выданные.map((у) =>
        el('li', {}, [
          el('span', { class: 'tcodes__name' }, у.имя),
          el('span', { class: 'tcodes__pin' }, у.код),
        ]),
      ),
    ),
    печать,
  ]);
}

/** Экран «Задать урок»: библиотека уроков и назначение классу. */
export function показатьНазначение(всё, перезагрузить) {
  const блок = el('div', {}, [el('p', { class: 'loading' }, 'Загружаю список уроков…')]);
  собратьБиблиотеку(блок, всё, перезагрузить);
  return блок;
}

async function собратьБиблиотеку(блок, всё, перезагрузить) {
  const классы = Object.entries(всё.classes);
  if (!классы.length) {
    clear(блок);
    блок.append(el('p', { class: 'empty' }, 'Сначала создай класс.'));
    return;
  }

  const уроки = [];
  for (const г of КЛАССЫ) {
    try {
      const курс = await loadCourse(г);
      for (const раздел of курс.sections) {
        for (const урок of раздел.lessons) уроки.push({ ...урок, grade: г, раздел: раздел.title });
      }
    } catch {
      // Курса этого класса ещё нет — это нормально, он появится позже.
    }
  }

  clear(блок);

  if (!уроки.length) {
    блок.append(el('p', { class: 'empty' }, 'Готовых уроков пока нет.'));
    return;
  }

  const выборКласса = el('select', { class: 'login__field', 'aria-label': 'Класс' });
  for (const [id, к] of классы) выборКласса.append(el('option', { value: id }, к.title));

  const срок = el('input', { class: 'login__field', type: 'date', 'aria-label': 'Сдать до' });

  блок.append(
    el('div', { class: 'tblock' }, [
      el('h2', {}, 'Кому и до какого числа'),
      el('div', { class: 'tform' }, [выборКласса, срок]),
      el('p', { class: 'q__hint' }, 'Урок можно задать любой, из любого класса — например, повторить шестой класс в девятом.'),
    ]),
    el(
      'ul',
      { class: 'tlessons' },
      уроки.map((урок) => строкаУрока(урок, выборКласса, срок, всё, перезагрузить)),
    ),
  );
}

function строкаУрока(урок, выборКласса, срок, всё, перезагрузить) {
  const состояние = el('span', { class: 'tlessons__state' });
  const кнопка = el('button', { class: 'button button--quiet', type: 'button' }, 'Задать');

  function обновитьСостояние() {
    const назначено = всё.assignments?.[выборКласса.value]?.[урок.id];
    состояние.textContent = назначено?.isOpen ? 'задан' : '';
    состояние.className = назначено?.isOpen ? 'tlessons__state tlessons__state--on' : 'tlessons__state';
  }
  выборКласса.addEventListener('change', обновитьСостояние);
  обновитьСостояние();

  кнопка.addEventListener('click', async () => {
    кнопка.setAttribute('disabled', 'true');
    состояние.textContent = 'Задаю…';
    try {
      const dueAt = срок.value ? new Date(`${срок.value}T23:59:59`).getTime() : null;
      await admin.задатьУрок({ classId: выборКласса.value, lessonId: урок.id, dueAt });
      состояние.textContent = 'задан';
      состояние.className = 'tlessons__state tlessons__state--on';
      перезагрузить({ тихо: true });
    } catch (error) {
      состояние.textContent = error.message;
    } finally {
      кнопка.removeAttribute('disabled');
    }
  });

  return el('li', { class: 'tlessons__row' }, [
    el('span', { class: 'tlessons__grade' }, урок.grade),
    el('span', { class: 'tlessons__title' }, урок.title),
    состояние,
    кнопка,
  ]);
}
