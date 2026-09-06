import test from 'node:test';
import assert from 'node:assert/strict';

import { ТЕМЫ, следующая, подпись, пояснение, атрибут, createTema } from '../../js/ui/tema.js';

test('переключатель ходит по кругу: система → день → ночь → система', () => {
  assert.equal(следующая('система'), 'день');
  assert.equal(следующая('день'), 'ночь');
  assert.equal(следующая('ночь'), 'система');
});

test('незнакомое значение не роняет круг', () => {
  assert.ok(ТЕМЫ.includes(следующая('чепуха')));
});

test('системной теме атрибута нет — решает система', () => {
  assert.equal(атрибут('система'), null);
  assert.equal(атрибут('день'), 'light');
  assert.equal(атрибут('ночь'), 'dark');
});

test('у каждой темы есть подпись и пояснение', () => {
  for (const тема of ТЕМЫ) {
    assert.ok(подпись(тема).length > 0, тема);
    assert.ok(пояснение(тема).length > 0, тема);
  }
});

test('выбор запоминается и восстанавливается', () => {
  const хранилище = хранение();
  const корень = узел();
  const кнопка = кнопкаЗаглушка();

  const первый = createTema({ storage: хранилище, root: корень, button: кнопка });
  assert.equal(первый.текущая(), 'система');
  assert.equal(корень.attrs['data-theme'], undefined);

  кнопка.нажать();
  assert.equal(корень.attrs['data-theme'], 'light');
  assert.equal(кнопка.textContent, 'День');

  // Новый заход — тема на месте.
  const второй = createTema({ storage: хранилище, root: узел(), button: кнопкаЗаглушка() });
  assert.equal(второй.текущая(), 'день');
});

test('без памяти переключатель всё равно работает', () => {
  // Приватное окно: чтение и запись бросают. Тема не запомнится, но нажатие
  // не должно ломать страницу — иначе шапка перестанет работать целиком.
  const битое = {
    getItem() {
      throw new Error('нет доступа');
    },
    setItem() {
      throw new Error('нет доступа');
    },
  };
  const корень = узел();
  const кнопка = кнопкаЗаглушка();

  const т = createTema({ storage: битое, root: корень, button: кнопка });
  assert.equal(т.текущая(), 'система');
  кнопка.нажать();
  assert.equal(т.текущая(), 'день');
  assert.equal(корень.attrs['data-theme'], 'light');
});

function хранение() {
  const данные = new Map();
  return {
    getItem: (k) => (данные.has(k) ? данные.get(k) : null),
    setItem: (k, v) => данные.set(k, String(v)),
  };
}

function узел() {
  return {
    attrs: {},
    setAttribute(имя, значение) {
      this.attrs[имя] = значение;
    },
    removeAttribute(имя) {
      delete this.attrs[имя];
    },
  };
}

function кнопкаЗаглушка() {
  return {
    textContent: '',
    attrs: {},
    обработчики: [],
    setAttribute(имя, значение) {
      this.attrs[имя] = значение;
    },
    addEventListener(_, fn) {
      this.обработчики.push(fn);
    },
    нажать() {
      for (const fn of this.обработчики) fn();
    },
  };
}
