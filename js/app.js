import { startRouter } from './router.js';
import { el, clear } from './ui/dom.js';
import { createRevealController } from './ui/reveal.js';
import { renderHomePage } from './pages/home.js';
import { renderClassPage } from './pages/class.js';
import { renderLessonPage } from './pages/lesson.js';

const PAGES = {
  home: renderHomePage,
  class: renderClassPage,
  lesson: renderLessonPage,
  sources: renderSourcesPage,
  notfound: renderNotFoundPage,
};

const mount = document.getElementById('app');
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

  revealController?.disconnect();
  revealController = createRevealController();
  for (const node of mount.querySelectorAll('.reveal')) {
    revealController.observe(node);
  }
});

async function renderSourcesPage() {
  return el('section', { class: 'sources' }, [
    el('h1', {}, 'Источники материалов'),
    el('p', {}, 'Иллюстрации и симуляции используются по открытым лицензиям:'),
    el('ul', {}, [
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
