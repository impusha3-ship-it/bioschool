import { createProgress } from './store.js';
import { auth } from '../pages/login.js';

/**
 * Один прогресс на всё приложение.
 *
 * Сессия подставляется здесь, а не внутри хранилища: хранилище не должно знать
 * про страницы и про вход, иначе его не проверить без браузера. Здесь же —
 * единственное место, где эти два слоя знакомятся.
 *
 * Учитель прогресс не копит: он в панели смотрит чужой, а свой ему не нужен.
 */
export const progress = createProgress({
  сессия: () => {
    const s = auth.current();
    return s?.kind === 'student' ? { studentId: s.studentId, classId: s.classId } : null;
  },
  токен: () => auth.token(),
});
