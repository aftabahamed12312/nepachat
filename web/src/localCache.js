const DATABASE_NAME = 'nepachat-local';
const DATABASE_VERSION = 1;
const STORE_NAME = 'records';

let databasePromise;

const openDatabase = () => {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is not available'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = null;
        reject(request.error || new Error('Unable to open the local cache'));
      };
      request.onblocked = () => {
        databasePromise = null;
        reject(new Error('The local cache is blocked by another open connection'));
      };
    });
  }
  return databasePromise;
};

const read = async key => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error || new Error('Unable to read the local cache'));
    transaction.onabort = () => reject(transaction.error || new Error('Unable to read the local cache'));
  });
};

const write = async (key, value) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, value });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Unable to save the local cache'));
    transaction.onabort = () => reject(transaction.error || new Error('Unable to save the local cache'));
  });
};

export const loadCachedChats = userId => read(`${userId}:chats`);
export const saveCachedChats = (userId, chats) => write(`${userId}:chats`, chats);
export const loadCachedMessages = (userId, chatId) => read(`${userId}:messages:${chatId}`);
export const saveCachedMessages = (userId, chatId, messages) => write(`${userId}:messages:${chatId}`, messages);
export const loadCachedFriends = userId => read(`${userId}:friends`);
export const saveCachedFriends = (userId, friends) => write(`${userId}:friends`, friends);
export const loadCachedActivity = userId => read(`${userId}:activity`);
export const saveCachedActivity = (userId, posts) => write(`${userId}:activity`, posts);
export const loadCachedActivityComments = userId => read(`${userId}:activity-comments`);
export const saveCachedActivityComments = (userId, comments) => write(`${userId}:activity-comments`, comments);
export const loadCachedSettings = userId => read(`${userId}:settings`);
export const saveCachedSettings = (userId, settings) => write(`${userId}:settings`, settings);
export const loadCachedCallHistory = userId => read(`${userId}:call-history`);
export const saveCachedCallHistory = (userId, history) => write(`${userId}:call-history`, history);

export const clearCachedUser = async userId => {
  const database = await openDatabase();
  const prefix = `${userId}:`;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.key.startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error('Unable to clear the local cache'));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Unable to clear the local cache'));
    transaction.onabort = () => reject(transaction.error || new Error('Unable to clear the local cache'));
  });
};
