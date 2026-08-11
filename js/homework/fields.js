import { el } from '../ui/dom.js';

/**
 * Отрисовка одного вопроса.
 *
 * Вопрос выглядит одинаково в трёх местах: в домашке, где ответ уходит в
 * журнал; в тренажёре, где он проверяется на месте; в просмотре, где отвечать
 * нельзя вовсе. Расходятся эти три места не разметкой, а тем, что можно
 * трогать и что показано заранее, — поэтому разметка здесь одна.
 *
 * `disabled` — поля не принимают ввод (просмотр).
 * `key` — рядом с верными вариантами стоит пометка (просмотр учителя).
 */
export function questionField(q, ответы = {}, настройки = {}) {
  const { document: doc = globalThis.document, disabled = false, key = false } = настройки;
  const e = (tag, attrs, children) => el(tag, attrs, children, { document: doc });

  const верные = correctIndexes(q);
  const метки = [];
  const входы = [];
  const тело = [];

  if (q.type === 'choice' || q.type === 'multi') {
    q.options.forEach((текст, index) => {
      const вход = e('input', {
        type: q.type === 'choice' ? 'radio' : 'checkbox',
        name: q.id,
        id: `${q.id}-${index}`,
        class: 'q__input',
        disabled: disabled ? 'true' : null,
      });

      вход.addEventListener('change', () => {
        if (q.type === 'choice') {
          ответы[q.id] = index;
          return;
        }
        const набор = new Set(ответы[q.id] ?? []);
        if (вход.checked) набор.add(index);
        else набор.delete(index);
        ответы[q.id] = [...набор];
      });

      const метка = e(
        'label',
        {
          class: key && верные.includes(index) ? 'q__option q__option--key' : 'q__option',
          for: `${q.id}-${index}`,
        },
        [вход, e('span', {}, текст)],
      );

      входы.push(вход);
      метки.push(метка);
      тело.push(метка);
    });
  } else if (q.type === 'open') {
    const поле = e('textarea', {
      class: 'q__open',
      rows: '6',
      'aria-label': 'Развёрнутый ответ',
      disabled: disabled ? 'true' : null,
    });
    поле.addEventListener('input', () => { ответы[q.id] = поле.value; });
    входы.push(поле);
    тело.push(поле);
  } else {
    const поле = e('input', {
      class: 'q__short',
      type: 'text',
      'aria-label': 'Ответ',
      disabled: disabled ? 'true' : null,
    });
    поле.addEventListener('input', () => { ответы[q.id] = поле.value; });
    входы.push(поле);
    тело.push(поле);
  }

  // Ключ к тем вопросам, где подсветить вариант нечем: короткий и развёрнутый.
  if (key && q.type === 'short') {
    тело.push(e('p', { class: 'q__key' }, `Верный ответ: ${(q.answers ?? [])[0] ?? '—'}`));
  }
  if (key && q.type === 'open' && q.maxScore) {
    тело.push(e('p', { class: 'q__key' }, `Учитель ставит до ${q.maxScore} баллов`));
  }

  const пометка = q.type === 'open' ? 'Проверяет учитель' : q.exam;
  const разбор = e('div', { class: 'q__verdict' });

  const блок = e('div', { class: q.type === 'open' ? 'q q--open' : 'q' }, [
    пометка ? e('span', { class: 'q__exam' }, пометка) : null,
    e('p', { class: 'q__text' }, q.text ?? q.prompt),
    q.hint ? e('p', { class: 'q__hint' }, q.hint) : null,
    e('div', { class: 'q__body' }, тело),
    разбор,
  ]);

  /**
   * Показывает исход проверки: где было верно, куда попал ученик и почему.
   * Разбор важнее вердикта — «неверно» без объяснения ничему не учит.
   */
  function showResult(ok) {
    for (const вход of входы) вход.setAttribute('disabled', 'true');

    метки.forEach((метка, index) => {
      if (верные.includes(index)) метка.className = 'q__option q__option--right';
      else if (входы[index]?.checked) метка.className = 'q__option q__option--wrong';
    });

    разбор.className = ok ? 'q__verdict q__verdict--right' : 'q__verdict q__verdict--wrong';
    разбор.append(
      ...[
        e('p', { class: 'q__verdict-line' }, ok ? 'Верно' : 'Неверно'),
        !ok && q.type === 'short'
          ? e('p', { class: 'q__verdict-text' }, `Верный ответ: ${(q.answers ?? [])[0] ?? '—'}`)
          : null,
        q.explanation ? e('p', { class: 'q__verdict-text' }, q.explanation) : null,
      ].filter(Boolean),
    );
  }

  return { element: блок, showResult };
}

/** Номера верных вариантов — в одном виде и для `choice`, и для `multi`. */
export function correctIndexes(q) {
  if (q?.type === 'choice') return Number.isInteger(q.correct) ? [q.correct] : [];
  if (q?.type === 'multi') return [...new Set(q.correct ?? [])];
  return [];
}
