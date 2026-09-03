import { el } from './dom.js';

/**
 * Полоса заполнения. Вынесена из страницы прогресса, когда такая же
 * понадобилась в списке уроков: две копии разошлись бы в подписях для
 * читалки экрана, а это ровно то место, где расхождение никто не заметит.
 */
export function полоса(процент) {
  const доля = Math.max(0, Math.min(100, Math.round(процент)));
  const заполнение = el('div', { class: 'bar__fill' });
  заполнение.setAttribute('style', `width: ${доля}%`);

  return el(
    'div',
    {
      class: 'bar',
      role: 'progressbar',
      'aria-valuenow': String(доля),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    },
    [заполнение],
  );
}
