import { el, clear } from '../ui/dom.js';
import { progress } from '../progress/index.js';
import { createLogin } from '../auth/login.js';
import { isValidPin, PIN_LENGTH } from '../auth/pin.js';

const login = createLogin();

/** Доступ к сессии для остальных страниц. */
export const auth = login;

export async function renderLoginPage() {
  const уже = login.current();
  if (уже) return renderWhoAmI(уже);

  const holder = el('div', { class: 'login' });
  showClasses(holder);
  return el('section', {}, [
    el('h1', {}, 'Вход'),
    holder,
    el('p', { class: 'login__teacher-link' }, [
      el('a', { href: '#/teacher-login' }, 'Я учитель'),
    ]),
  ]);
}

function renderWhoAmI(session) {
  const выйти = el('button', { class: 'button button--quiet', type: 'button' }, 'Выйти');
  выйти.addEventListener('click', () => {
    login.logout();
    // Иначе на общем компьютере следующий увидел бы в шапке чужие баллы.
    progress.забыть();
    location.hash = '#/login';
    location.reload();
  });

  const учитель = session.kind === 'teacher';

  return el('section', {}, [
    el('h1', {}, учитель ? 'Вы вошли' : 'Ты уже вошёл'),
    el('p', { class: 'login__who' }, учитель ? `Учитель: ${session.email}` : session.name),
    el('div', { class: 'login__actions' }, [
      /*
        Учителю панель нужна первой, а до этой правки её тут не было вовсе:
        со страницы входа вела одна кнопка — к урокам, — и попасть в журнал
        можно было, только набрав адрес руками.
      */
      учитель ? el('a', { class: 'button', href: '#/teacher' }, 'Журнал и панель') : null,
      el('a', { class: учитель ? 'button button--quiet' : 'button', href: '#/' }, 'К урокам'),
      выйти,
    ]),
  ]);
}

/** Шаг 1 — класс. */
async function showClasses(holder) {
  clear(holder);
  holder.append(el('p', { class: 'loading' }, 'Загружаю списки…'));

  let классы;
  try {
    классы = await login.loadClasses();
  } catch (error) {
    return fail(holder, error.message);
  }

  clear(holder);
  if (!классы.length) {
    holder.append(
      el('p', { class: 'empty' }, 'Классы ещё не заведены. Попроси учителя добавить твой класс.'),
    );
    return;
  }

  holder.append(
    el('p', { class: 'login__step' }, 'Выбери свой класс'),
    el(
      'div',
      { class: 'login__grid' },
      классы.map((c) => {
        const btn = el('button', { class: 'login__tile', type: 'button' }, c.title);
        btn.addEventListener('click', () => showStudents(holder, c));
        return btn;
      }),
    ),
  );
}

/** Шаг 2 — фамилия. */
async function showStudents(holder, класс) {
  clear(holder);
  holder.append(el('p', { class: 'loading' }, 'Загружаю список…'));

  let ученики;
  try {
    ученики = await login.loadStudents(класс.id);
  } catch (error) {
    return fail(holder, error.message);
  }

  clear(holder);
  holder.append(назад(() => showClasses(holder), 'Другой класс'));

  if (!ученики.length) {
    holder.append(el('p', { class: 'empty' }, `В классе ${класс.title} пока никого нет.`));
    return;
  }

  holder.append(
    el('p', { class: 'login__step' }, `${класс.title} — найди себя`),
    el(
      'div',
      { class: 'login__list' },
      ученики.map((s) => {
        const btn = el('button', { class: 'login__name', type: 'button' }, s.name);
        btn.addEventListener('click', () => showPin(holder, класс, s));
        return btn;
      }),
    ),
  );
}

/** Шаг 3 — PIN. */
function showPin(holder, класс, ученик) {
  clear(holder);

  const поле = el('input', {
    class: 'login__pin',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    maxlength: String(PIN_LENGTH),
    'aria-label': 'Код из четырёх цифр',
  });

  const ошибка = el('p', { class: 'login__error' });
  const кнопка = el('button', { class: 'button', type: 'submit' }, 'Войти');

  const форма = el('form', { class: 'login__form' }, [поле, кнопка]);

  форма.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pin = поле.value.trim();

    if (!isValidPin(pin)) {
      ошибка.textContent = `Код — это ${PIN_LENGTH} цифры.`;
      return;
    }

    ошибка.textContent = '';
    кнопка.setAttribute('disabled', 'true');
    кнопка.textContent = 'Проверяю…';

    try {
      await login.loginStudent(
        { studentId: ученик.id, name: ученик.name, classId: класс.id, salt: ученик.salt },
        pin,
      );
      location.hash = '#/';
      location.reload();
    } catch (error) {
      ошибка.textContent = error.message;
      поле.value = '';
      кнопка.removeAttribute('disabled');
      кнопка.textContent = 'Войти';
      поле.focus();
    }
  });

  holder.append(
    назад(() => showStudents(holder, класс), 'Не я'),
    el('p', { class: 'login__step' }, ученик.name),
    el('p', { class: 'login__hint' }, 'Введи свой код из четырёх цифр'),
    форма,
    ошибка,
  );
  поле.focus();
}

/** Отдельный экран для учителя: ученикам он не нужен и только мешал бы. */
export async function renderTeacherLoginPage() {
  const уже = login.current();
  if (уже?.kind === 'teacher') return renderWhoAmI(уже);

  const почта = el('input', { class: 'login__field', type: 'email', autocomplete: 'username', 'aria-label': 'Почта' });
  const пароль = el('input', { class: 'login__field', type: 'password', autocomplete: 'current-password', 'aria-label': 'Пароль' });
  const ошибка = el('p', { class: 'login__error' });
  const кнопка = el('button', { class: 'button', type: 'submit' }, 'Войти');

  const форма = el('form', { class: 'login__form login__form--teacher' }, [почта, пароль, кнопка]);

  форма.addEventListener('submit', async (event) => {
    event.preventDefault();
    ошибка.textContent = '';
    кнопка.setAttribute('disabled', 'true');
    кнопка.textContent = 'Проверяю…';

    try {
      await login.loginTeacher(почта.value.trim(), пароль.value);
      location.hash = '#/';
      location.reload();
    } catch (error) {
      ошибка.textContent = error.message;
      кнопка.removeAttribute('disabled');
      кнопка.textContent = 'Войти';
    }
  });

  return el('section', {}, [
    el('a', { class: 'back-link', href: '#/login' }, '← Я ученик'),
    el('h1', {}, 'Вход для учителя'),
    форма,
    ошибка,
  ]);
}

function назад(действие, подпись) {
  const btn = el('button', { class: 'back-link back-link--button', type: 'button' }, `← ${подпись}`);
  btn.addEventListener('click', действие);
  return btn;
}

function fail(holder, сообщение) {
  clear(holder);
  holder.append(el('p', { class: 'login__error' }, сообщение));
}
