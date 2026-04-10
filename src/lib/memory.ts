import { openDB, type IDBPDatabase } from 'idb';

export interface MemoryEntry {
  id?: number;
  type: 'preference' | 'note' | 'interaction';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

const DB_NAME = 'aura-memory';
const STORE_NAME = 'entries';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('type', 'type');
        store.createIndex('timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

export const MemoryManager = {
  async addEntry(entry: Omit<MemoryEntry, 'id' | 'timestamp'>) {
    const db = await getDB();
    return db.add(STORE_NAME, {
      ...entry,
      timestamp: Date.now(),
    });
  },

  async getEntriesByType(type: MemoryEntry['type']) {
    const db = await getDB();
    return db.getAllFromIndex(STORE_NAME, 'type', type);
  },

  async getAllEntries() {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  },

  async searchEntries(query: string) {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    return all.filter(entry => 
      entry.content.toLowerCase().includes(query.toLowerCase())
    );
  },

  async clearMemory() {
    const db = await getDB();
    return db.clear(STORE_NAME);
  }
};
