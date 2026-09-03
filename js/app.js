import { startRouter } from './router.js';
import { el, clear } from './ui/dom.js';
import { createRevealController } from './ui/reveal.js';
import { renderHomePage } from './pages/home.js';
import { renderClassPage } from './pages/class.js';
import { renderLessonPage } from './pages/lesson.js';
import { renderLoginPage, renderTeacherLoginPage, auth } from './pages/login.js';
import { renderTeacherPage } from './pages/teacher.js';
import { renderMePage } from './pages/me.js';
import { renderTabloPage } from './pages/tablo.js';
import { progress } from './progress/index.js';
import { итог } from './progress/core.js';

const PAGES = {
  home: renderHomePage,
  class: renderClassPage,
  lesson: renderLessonPage,
  login: renderLoginPage,
  teacher: renderTeacherPage,
  teacherLogin: renderTeacherLoginPage,
  me: renderMePage,
  tablo: renderTabloPage,
  sources: renderSourcesPage,
  notfound: renderNotFoundPage,
};

const mount = document.getElementById('app');
const who = document.getElementById('who');
const уровень = document.getElementById('level');

/**
 * Шапка показывает, кто вошёл, и на какой ты ступени.
 *
 * Ступень видна и гостю: баллы копятся у него так же, и метка — то место,
 * откуда он узнаёт, что они вообще есть.
 */
function updateWho() {
  const s = auth.current();
  if (!s) who.textContent = 'Войти';
  else who.textContent = s.kind === 'teacher' ? 'Учитель' : s.name.split(' ')[0];

  const свод = итог(progress.read());
  уровень.textContent = свод.xp ? `${свод.ступень.имя} · ${свод.xp}` : 'Прогресс';
}
updateWho();

// Перенос прогресса в базу и обратно. Зовётся при каждом запуске, и это не
// расточительство: слияние берёт наибольшее, поэтому повторный вызов ничего
// не меняет. Заодно на новом устройстве прогресс приезжает сам.
progress.перенести().catch(() => {});

let currentToken = 0;
let revealController = null;

startRouter(async (route) => {
  const token = ++currentToken;
  clear(mount);
  mount.append(el('p', { class: 'loading' }, 'Загрузка…'));

  let view;
  try {
    view = await PAGES[route.name](route.params);
  } catch (error) {
    view = el('section', { class: 'error' }, [
      el('h1', {}, 'Что-то пошло не так'),
      el('p', {}, error.message),
      el('a', { class: 'button', href: '#/' }, 'На главную'),
    ]);
  }

  // Пока грузились, пользователь мог уйти на другой адрес — тогда рисовать не надо.
  if (token !== currentToken) return;

  clear(mount);
  mount.append(view);
  window.scrollTo(0, 0);

  // Баллы могли измениться прямо на этой странице — метка в шапке обновляется
  // на каждом переходе, иначе она врала бы до перезагрузки.
  updateWho();

  revealController?.disconnect();
  revealController = createRevealController();
  for (const node of mount.querySelectorAll('.reveal')) {
    revealController.observe(node);
  }
});

/**
 * Права на фотографии лежат данными, а не в этом файле.
 *
 * Причина простая: фотографии добавляются пачками к заданиям, и если запись
 * автора живёт в коде страницы, её забудут обновить — а показывать снимок,
 * не назвав автора, нельзя. Из данных же список сходится сам, и тест сверяет
 * его с тем, что вправду используется в уроках.
 */
async function фотоПрава() {
  try {
    const ответ = await fetch('./content/foto-prava.json');
    if (!ответ.ok) return [];
    return (await ответ.json()).фотографии ?? [];
  } catch {
    return [];
  }
}

async function renderSourcesPage() {
  const фото = await фотоПрава();

  return el('section', { class: 'sources' }, [
    el('h1', {}, 'Источники материалов'),
    el('p', {}, 'Иллюстрации и симуляции используются по открытым лицензиям:'),
    el('ul', {}, [
      el(
        'li',
        {},
        'Схема микроскопа — рисунок участника Tomia, Викисклад, CC BY 2.5, переработан: подписи и цвета заменены',
      ),
      el(
        'li',
        {},
        'Схема хламидомонады — рисунок Sundance Raphael, Викисклад, CC BY-SA 3.0, переработан: ' +
          'взята геометрия, цвета и подписи заменены. Переработка распространяется на тех же ' +
          'условиях — CC BY-SA 3.0',
      ),
      фото.length
        ? el('li', {}, [
            'Фотографии к заданиям ВПР — Викисклад:',
            el(
              'ul',
              {},
              фото.map((ф) => el('li', {}, `${ф.что} — ${ф.автор}, ${ф.лицензия}`)),
            ),
          ])
        : null,
      el('li', {}, 'Servier Medical Art — CC BY 4.0, smart.servier.com'),
      el('li', {}, 'NIH BioArt Source — public domain, bioart.niaid.nih.gov'),
      el('li', {}, 'BioIcons — bioicons.com'),
      el('li', {}, 'SciDraw — CC BY 4.0, scidraw.io'),
      el('li', {}, 'Wikimedia Commons — commons.wikimedia.org'),
      el(
        'li',
        {},
        'Simulations by PhET Interactive Simulations, University of Colorado Boulder, CC BY 4.0, phet.colorado.edu',
      ),
    ]),
    el('a', { class: 'button', href: '#/' }, 'На главную'),
  ]);
}

async function renderNotFoundPage({ path }) {
  return el('section', { class: 'error' }, [
    el('h1', {}, 'Страница не найдена'),
    el('p', {}, `Адрес «${path}» не существует.`),
    el('a', { class: 'button', href: '#/' }, 'На главную'),
  ]);
}
