import { el } from './dom.js';

/**
 * Плашка «учитель проверил» — то, чем заканчивается ожидание балла за
 * развёрнутый ответ.
 *
 * Живёт над страницей, а не всплывает на четыре секунды, как плашка баллов:
 * та говорит про действие, которое ученик только что сделал сам и видел
 * своими глазами, а эта — про чужое действие, случившееся, пока его тут не
 * было. Всплывающую он пропустит, а второй раз ему её не покажут, и балл
 * так и останется неувиденным.
 *
 * Поэтому плашка висит, пока её не тронут. Любое касание — переход к работе
 * или крестик — значит «прочитал»: балл и слово учителя написаны прямо в ней,
 * и к этому моменту ученик их уже увидел.
 */
export function плашкаПроверок(
  проверки = [],
  { названия = new Map(), document: doc = globalThis.document, onRead = null } = {},
) {
  if (!проверки.length) return null;
  const e = (tag, attrs, children) => el(tag, attrs, children, { document: doc });

  const узел = e('div', { class: 'notice', role: 'status' });

  const закрыть = e('button', {
    class: 'notice__close',
    type: 'button',
    'aria-label': 'Закрыть уведомление',
  }, '×');

  const прочитано = () => {
    узел.remove?.();
    onRead?.(проверки);
  };

  закрыть.addEventListener('click', прочитано);

  const строки = проверки.map((п) => {
    const ссылка = e(
      'a',
      { class: 'notice__link', href: `#/lesson/${п.lessonId}/homework` },
      названия.get(п.lessonId) ?? п.lessonId,
    );
    ссылка.addEventListener('click', прочитано);

    return e('li', { class: 'notice__row' }, [
      ссылка,
      e('span', { class: 'notice__score' }, `балл за развёрнутый ответ: ${п.manualScore}`),
      п.comment ? e('p', { class: 'notice__comment' }, п.comment) : null,
    ].filter(Boolean));
  });

  узел.append(
    e('p', { class: 'notice__title' },
      проверки.length === 1 ? 'Учитель проверил твою работу' : 'Учитель проверил твои работы'),
    e('ul', { class: 'notice__list' }, строки),
    закрыть,
  );

  return узел;
}
