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
 * Проверяются только вопросы с автопроверкой: развёрнутый ответ смотрит
 * учитель, и в тренажёре ему делать нечего.
 */
export function createQuiz(вопросы, { document: doc = globalThis.document } = {}) {
  const e = (tag, attrs, children) => el(tag, attrs, children, { document: doc });
  const годные = (вопросы ?? []).filter(isAuto);

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
    поля = годные.map((q) => questionField(q, ответы, { document: doc }));
    clear(холст);
    холст.append(...поля.map((п) => п.element));
    итог.textContent = '';
    итог.className = 'quiz__score';
    clear(подвал);
    подвал.append(проверить, итог);
  }

  проверить.addEventListener('click', () => {
    let верных = 0;
    годные.forEach((q, i) => {
      const исход = checkAnswer(q, ответы[q.id]);
      if (исход.ok) верных += 1;
      поля[i].showResult(исход.ok);
    });

    результат = { correct: верных, total: годные.length };
    итог.textContent = `Верно ${верных} из ${годные.length}`;
    итог.className = верных === годные.length ? 'quiz__score quiz__score--win' : 'quiz__score quiz__score--miss';
    clear(подвал);
    подвал.append(заново, итог);
  });

  заново.addEventListener('click', собрать);
  собрать();

  const element = e('div', { class: 'quiz' }, [холст, подвал]);

  return {
    element,
    /** Сколько вопросов и сколько из них разобрано верно; до проверки — null. */
    getResult: () => (результат ? { ...результат } : null),
    reset: собрать,
    size: годные.length,
  };
}
