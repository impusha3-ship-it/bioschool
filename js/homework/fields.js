import { el } from '../ui/dom.js';
import { loadFigure, parseSvg } from '../ui/figure.js';

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

  // У заданий, взятых из настоящих работ, в пометке стоит год, вариант и номер
  // задания в работе. Это не украшение: ученик видит, что решает не выдумку,
  // а то, что уже стояло в работе, — и привыкает не только к формулировке, но
  // и к тому, каким номером что в работе стоит.
  //
  // Номера старых типов начинаются с «Д». Они каталожные: в самой работе такого
  // номера нет, показывать его ученику значит приучать к несуществующему.
  //
  // «Проверяет учитель» стоит только у своих открытых вопросов домашки.
  // У развёрнутого задания из настоящей работы источник важнее: в тренажёре
  // учителя нет, ответ ученик сверяет с ключом сам, и знать, откуда задание,
  // ему полезно ровно так же, как у любого другого.
  const номерВРаботе = q.vprType && !q.vprType.startsWith('Д') ? ` · задание ${q.vprType}` : '';
  const пометка = q.source
    ? q.source + номерВРаботе
    : (q.type === 'open' ? 'Проверяет учитель' : q.exam);
  const разбор = e('div', { class: 'q__verdict' });

  const блок = e('div', { class: q.type === 'open' ? 'q q--open' : 'q' }, [
    пометка ? e('span', { class: 'q__exam' }, пометка) : null,
    e('p', { class: 'q__text' }, q.text ?? q.prompt),
    рисунки(q, e, doc),
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

    /*
      Развёрнутый ответ машина не судит и судить не может: в настоящей работе
      его читает человек и сверяет с содержанием верного ответа. Здесь ровно
      так же — показывается ключ работы, а сравнивает ученик сам. Поставить
      «Верно» или «Неверно» было бы враньём в обе стороны: и засчитать
      бессмыслицу, и забраковать верный ответ другими словами.
    */
    if (q.type === 'open') {
      разбор.className = 'q__verdict q__verdict--key';
      разбор.append(
        ...[
          e('p', { class: 'q__verdict-line' }, 'Сверь свой ответ с ключом'),
          q.answerKey ? e('p', { class: 'q__verdict-text' }, q.answerKey) : null,
          q.explanation ? e('p', { class: 'q__verdict-text' }, q.explanation) : null,
        ].filter(Boolean),
      );
      return;
    }

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

/**
 * Рисунки к заданию: подписанные буквами картинки, по которым и задан вопрос.
 *
 * Схема грузится и вставляется отдельно от разметки, как и в конспекте: узел
 * появляется сразу, содержимое подтягивается следом. Если файл не загрузился,
 * на месте рисунка остаётся буква и пояснение — тогда видно, что задание не
 * решается, а не просто «пусто».
 */
function рисунки(q, e, doc) {
  const список = q.figures ?? (q.figure ? [{ src: q.figure }] : []);
  if (!список.length) return null;

  return e(
    'div',
    { class: список.length > 1 ? 'q__figures q__figures--ryad' : 'q__figures' },
    список.map((рисунок) => {
      const холст = e('div', { class: 'q__figure-holder' });

      // Фотография вставляется картинкой, схема — узлами SVG. Разница не в
      // прихоти: схема должна подхватывать цвета темы, а фотография — нет,
      // и разбирать её как разметку незачем.
      if (/\.(jpg|jpeg|png|webp)$/i.test(рисунок.src)) {
        холст.append(
          e('img', {
            class: 'q__figure-photo',
            src: `./img/bio/${рисунок.src}`,
            alt: рисунок.alt ?? '',
            loading: 'lazy',
          }),
        );
      } else {
        loadFigure(рисунок.src)
          .then((текст) => {
            const svg = parseSvg(текст, { doc });
            if (!svg) return;
            // Тот же класс, что у схем в конспекте: на нём висит вся раскраска
            // частей (жилки, подписи, стрелки), и без него рисунок выйдет
            // бесцветным пятном.
            svg.setAttribute('class', 'figure__svg q__figure-svg');
            холст.append(svg);
          })
          .catch(() => {
            холст.append(e('p', { class: 'q__figure-missing' }, 'Рисунок не загрузился'));
          });
      }

      return e('figure', { class: 'q__figure' }, [
        холст,
        рисунок.label ? e('figcaption', { class: 'q__figure-label' }, рисунок.label) : null,
      ]);
    }),
  );
}

/** Номера верных вариантов — в одном виде и для `choice`, и для `multi`. */
export function correctIndexes(q) {
  if (q?.type === 'choice') return Number.isInteger(q.correct) ? [q.correct] : [];
  if (q?.type === 'multi') return [...new Set(q.correct ?? [])];
  return [];
}
