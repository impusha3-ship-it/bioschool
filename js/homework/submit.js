import * as rest from '../api/firebase-rest.js';
import { SCHOOL_ID } from '../firebase-config.js';
import { combineScore } from './questions.js';

const ROOT = `schools/${SCHOOL_ID}`;

/**
 * Сдача домашней работы и всё вокруг неё.
 *
 * Главное правило: **в журнал идёт первая попытка**. Дальше тренироваться
 * можно сколько угодно, но оценка уже поставлена. Это условие держится не
 * на интерфейсе, а на правилах базы — ученик физически не может переписать
 * уже сданную работу, а не просто не видит кнопки.
 *
 * Поэтому повторные прохождения пишутся не в работу, а в свой прогресс:
 * туда ученику писать можно, и оценку это не трогает.
 */
export function createHomework({ api = rest, now = () => Date.now() } = {}) {
  /** Что назначено классу. */
  async function loadAssignments(classId) {
    if (!classId) return {};
    return (await api.dbGet(`${ROOT}/assignments/${classId}`)) ?? {};
  }

  /** Уже сданные работы ученика. Читаются только свои. */
  async function loadSubmissions(studentId, token) {
    if (!studentId || !token) return {};
    try {
      return (await api.dbGet(`${ROOT}/submissions/${studentId}`, { token })) ?? {};
    } catch {
      // Ещё ничего не сдано или доступа нет — для интерфейса это одно и то же.
      return {};
    }
  }

  /** Собирает работу в то, что уйдёт в базу. */
  function buildSubmission({ gameResult, questionResult, answers, open, dueAt }) {
    const итог = combineScore({ game: gameResult, questions: questionResult });
    const submittedAt = now();
    return {
      attempt: 1,
      submittedAt,
      isLate: Boolean(dueAt) && submittedAt > dueAt,
      correct: итог.correct,
      total: итог.total,
      percent: итог.percent,
      answers: answers ?? {},
      open: open ?? {},
    };
  }

  /**
   * Сдаёт работу. Если она уже сдана, база откажет — и это правильный ответ,
   * а не сбой: переписывать оценку нельзя.
   */
  async function submit({ studentId, lessonId, token, ...работа }) {
    const тело = buildSubmission(работа);
    try {
      await api.dbPut(`${ROOT}/submissions/${studentId}/${lessonId}`, тело, { token });
    } catch (error) {
      if (/Доступ запрещён/.test(error.message)) {
        throw new Error('Эта работа уже сдана. Переписать её нельзя, но потренироваться можно сколько угодно.');
      }
      throw error;
    }
    return тело;
  }

  /** Повторное прохождение: в оценку не идёт, но виден прогресс. */
  async function recordPractice({ studentId, lessonId, token, correct, total }) {
    if (!studentId || !token) return null;
    const запись = { at: now(), correct, total };
    try {
      await api.dbPut(`${ROOT}/progress/${studentId}/practice/${lessonId}`, запись, { token });
    } catch {
      // Тренировка — не то, ради чего стоит показывать ошибку.
      return null;
    }
    return запись;
  }

  return { loadAssignments, loadSubmissions, buildSubmission, submit, recordPractice };
}
