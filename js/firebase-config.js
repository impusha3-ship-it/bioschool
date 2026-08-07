/**
 * Настройки подключения к Firebase.
 *
 * Эти значения не секрет и намеренно лежат в открытом репозитории: они всё
 * равно попадают в код страницы и видны каждому, кто её откроет. Так у Firebase
 * и задумано — доступ к данным закрывают правила базы (database.rules.json),
 * а не скрытность ключа.
 *
 * Настоящий секрет здесь только один — пароль учителя, и он не хранится нигде
 * в коде: им управляет Firebase Authentication.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBtCPBQQQbbrC9ij4UEztKjw9Yyon0dlXw',
  authDomain: 'bioschool-e9271.firebaseapp.com',
  databaseURL: 'https://bioschool-e9271-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'bioschool-e9271',
  storageBucket: 'bioschool-e9271.firebasestorage.app',
  messagingSenderId: '452256878872',
  appId: '1:452256878872:web:738abd32d36fcda1268e6d',
};

/** Школа — корень всех данных. Пригодится, если когда-нибудь добавится вторая. */
export const SCHOOL_ID = 'apts';
