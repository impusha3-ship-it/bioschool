import { el, clear } from '../ui/dom.js';
import { questionField } from './fields.js';
import { checkAnswer, isAuto } from './questions.js';

/**
 * Набор заданий с проверкой на месте.
 *
 * Отличие от домашки принципиальное: здесь результат никуда не идёт, зато
 * сразу видно, где ошибся и почему. Это разные вещи — оценить и научить, — и
 * смешивать их в одном экране нельзя: под оценкой ученик боится ошибиться, а
 * без разбора ошибка ничему не учит.
 *
 * Считаются только вопросы с автопроверкой. Развёрнутые задания показываются
 * наравне с остальными — семь типов настоящей работы отвечаются словами, и
 * подменить их выбором из списка значит не показать тип вовсе, — но вердикта
 * им не ставится: по проверке к ним выводится ключ работы, и сверяет ученик
 * сам, ровно как это делает человек, проверяющий работу.
 */
export function createQuiz(вопросы, { document: doc = globalThis.document, onChecked = null } = {}) {
  const e = (tag, attrs, children) => el(tag, attrs, children, { document: doc });
  const все = вопросы ?? [];
  const годные = все.filter(isAuto);

  /*
    Счёт считает только то, что машина проверила. Если этого не сказать,
    «Верно 2 из 5» при восьми заданиях на экране читается как потеря трёх —
    ученик решит, что ошибся там, где его никто и не судил.
  */
  const примечание = годные.length < все.length
    ? e(
        'p',
        { class: 'quiz__note' },
        'Развёрнутые ответы машина не проверяет: по кнопке «Проверить» к ним показывается ключ работы, и сверяешь ты сам. В счёт они не идут.',
      )
    : null;

  const холст = e('div', { class: 'quiz__questions' });
  const итог = e('p', { class: 'quiz__score' });
  const проверить = e('button', { class: 'button', type: 'button' }, 'Проверить');
  const заново = e('button', { class: 'button button--quiet', type: 'button' }, 'Ещё раз');
  const подвал = e('div', { class: 'quiz__footer' }, [проверить, итог]);

  let ответы = {};
  let поля = [];
  let результат = null;

  function собрать() {
    ответы = {};
    результат = null;
    поля = все.map((q) => questionField(q, ответы, { document: doc }));
    clear(холст);
    холст.append(...поля.map((п) => п.element));
    итог.textContent = '';
    итог.className = 'quiz__score';
    clear(подвал);
    подвал.append(проверить, итог);
  }

  проверить.addEventListener('click', () => {
    let верных = 0;
    все.forEach((q, i) => {
      // Развёрнутому ответу вердикт не ставится — ему показывается ключ,
      // и в счёт он не идёт: считать можно только то, что машина проверила.
      if (!isAuto(q)) {
        поля[i].showResult(null);
        return;
      }
      const исход = checkAnswer(q, ответы[q.id]);
      if (исход.ok) верных += 1;
      поля[i].showResult(исход.ok);
    });

    результат = { correct: верных, total: годные.length };
    // Тренажёр по-прежнему никуда не отправляет ответы: наружу уходит только
    // счёт, и только чтобы начислить баллы.
    onChecked?.({ ...результат });
    итог.textContent = `Верно ${верных} из ${годные.length}`;
    итог.className = верных === годные.length ? 'quiz__score quiz__score--win' : 'quiz__score quiz__score--miss';
    clear(подвал);
    подвал.append(заново, итог);
  });

  заново.addEventListener('click', собрать);
  собрать();

  const element = e('div', { class: 'quiz' }, [примечание, холст, подвал].filter(Boolean));

  return {
    element,
    /** Сколько вопросов и сколько из них разобрано верно; до проверки — null. */
    getResult: () => (результат ? { ...результат } : null),
    reset: собрать,
    size: годные.length,
  };
}
