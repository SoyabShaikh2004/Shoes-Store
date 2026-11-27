import { MongoClient, Db, AnyBulkWriteOperation, Document } from 'mongodb';
import type { DatabaseSchema } from './schema';

const globalForMongo = globalThis as typeof globalThis & {
  __stepstyleMongoClientPromise?: Promise<MongoClient>;
  __stepstyleMongoUri?: string;
  __stepstyleMongoIndexesReady?: boolean;
};

export const MONGO_COLLECTIONS = {
  users: 'users',
  adminUsers: 'admin_users',
  categories: 'categories',
  brands: 'brands',
  products: 'products',
  productImages: 'product_images',
  productVariants: 'product_variants',
  orders: 'orders',
  orderItems: 'order_items',
  orderStatusHistory: 'order_status_history',
  payments: 'payments',
  shipping: 'shipping',
  returns: 'returns',
  refunds: 'refunds',
  adminNotes: 'admin_notes',
  notifications: 'notifications',
  adminNotifications: 'admin_notifications',
  heroBanners: 'hero_banners',
  supportMessages: 'support_messages',
  meta: 'store_meta',
} as const;

type ArraySchemaKey = Exclude<keyof DatabaseSchema, 'version' | 'lastPurgedAt'>;

const COLLECTION_KEYS: Array<{ schemaKey: ArraySchemaKey; collectionName: string }> = [
  { schemaKey: 'users', collectionName: MONGO_COLLECTIONS.users },
  { schemaKey: 'adminUsers', collectionName: MONGO_COLLECTIONS.adminUsers },
  { schemaKey: 'categories', collectionName: MONGO_COLLECTIONS.categories },
  { schemaKey: 'brands', collectionName: MONGO_COLLECTIONS.brands },
  { schemaKey: 'products', collectionName: MONGO_COLLECTIONS.products },
  { schemaKey: 'productImages', collectionName: MONGO_COLLECTIONS.productImages },
  { schemaKey: 'productVariants', collectionName: MONGO_COLLECTIONS.productVariants },
  { schemaKey: 'orders', collectionName: MONGO_COLLECTIONS.orders },
  { schemaKey: 'orderItems', collectionName: MONGO_COLLECTIONS.orderItems },
  { schemaKey: 'orderStatusHistory', collectionName: MONGO_COLLECTIONS.orderStatusHistory },
  { schemaKey: 'payments', collectionName: MONGO_COLLECTIONS.payments },
  { schemaKey: 'shipping', collectionName: MONGO_COLLECTIONS.shipping },
  { schemaKey: 'returns', collectionName: MONGO_COLLECTIONS.returns },
  { schemaKey: 'refunds', collectionName: MONGO_COLLECTIONS.refunds },
  { schemaKey: 'adminNotes', collectionName: MONGO_COLLECTIONS.adminNotes },
  { schemaKey: 'notifications', collectionName: MONGO_COLLECTIONS.notifications },
  { schemaKey: 'adminNotifications', collectionName: MONGO_COLLECTIONS.adminNotifications },
  { schemaKey: 'heroBanners', collectionName: MONGO_COLLECTIONS.heroBanners },
  { schemaKey: 'supportMessages', collectionName: MONGO_COLLECTIONS.supportMessages },
];

export function isMongoConfigured(): boolean {
  const uri = (process.env.MONGODB_URI || '').trim();
  return uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://');
}

function resolveMongoDbName(uri: string): string {
  const explicit = (process.env.MONGODB_DB_NAME || '').trim();
  if (explicit) return explicit;

  try {
    const parsed = new URL(uri);
    const dbSegment = parsed.pathname.replace(/^\/+/, '').split('/')[0];
    if (dbSegment) return decodeURIComponent(dbSegment);
  } catch {
    // ignore URL parse error and use default database name
  }

  return 'stepstyle';
}

export function sanitizeMongoError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'MongoDB error');
  // Strip any embedded credentials in connection strings if present in error messages
  return raw.replace(/mongodb(\+srv)?:\/\/[^\s@]+@/gi, 'mongodb$1://***:***@');
}

async function getMongoClient(): Promise<MongoClient> {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI is not configured with a valid mongodb:// or mongodb+srv:// URI.');
  }

  // Reconnect if MONGODB_URI changed dynamically in runtime
  if (globalForMongo.__stepstyleMongoClientPromise && globalForMongo.__stepstyleMongoUri === uri) {
    return globalForMongo.__stepstyleMongoClientPromise;
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  const promise = client.connect().catch((err) => {
    globalForMongo.__stepstyleMongoClientPromise = undefined;
    globalForMongo.__stepstyleMongoUri = undefined;
    globalForMongo.__stepstyleMongoIndexesReady = false;
    throw new Error(`MongoDB connection failed: ${sanitizeMongoError(err)}`);
  });

  globalForMongo.__stepstyleMongoClientPromise = promise;
  globalForMongo.__stepstyleMongoUri = uri;
  return promise;
}

export async function getMongoDatabase(): Promise<Db> {
  const uri = (process.env.MONGODB_URI || '').trim();
  const client = await getMongoClient();
  const db = client.db(resolveMongoDbName(uri));

  if (!globalForMongo.__stepstyleMongoIndexesReady) {
    await ensureMongoIndexes(db);
    globalForMongo.__stepstyleMongoIndexesReady = true;
  }

  return db;
}

async function ensureMongoIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(MONGO_COLLECTIONS.products).createIndex({ id: 1 }, { unique: true }),
    db.collection(MONGO_COLLECTIONS.products).createIndex({ sku: 1 }),
    db.collection(MONGO_COLLECTIONS.orders).createIndex({ id: 1 }, { unique: true }),
    db.collection(MONGO_COLLECTIONS.orders).createIndex({ orderNumber: 1 }, { unique: true }),
    db.collection(MONGO_COLLECTIONS.orders).createIndex({ createdAt: -1 }),
    db.collection(MONGO_COLLECTIONS.orders).createIndex({ userId: 1 }),
    db.collection(MONGO_COLLECTIONS.users).createIndex({ id: 1 }, { unique: true }),
    db.collection(MONGO_COLLECTIONS.users).createIndex({ email: 1 }),
    db.collection(MONGO_COLLECTIONS.users).createIndex({ phone: 1 }),
    db.collection(MONGO_COLLECTIONS.adminUsers).createIndex({ id: 1 }, { unique: true }),
    db.collection(MONGO_COLLECTIONS.adminUsers).createIndex({ email: 1 }, { unique: true }),
    db.collection(MONGO_COLLECTIONS.orderItems).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.orderStatusHistory).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.payments).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.shipping).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.returns).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.refunds).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.adminNotes).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.notifications).createIndex({ orderId: 1 }),
    db.collection(MONGO_COLLECTIONS.adminNotifications).createIndex({ createdAt: -1 }),
    db.collection(MONGO_COLLECTIONS.heroBanners).createIndex({ id: 1 }, { unique: true }),
    db.collection(MONGO_COLLECTIONS.supportMessages).createIndex({ createdAt: -1 }),
  ]);
}

function getRecordKey(record: Record<string, unknown>): string | number {
  const idVal = record.id;
  if (typeof idVal === 'string' || typeof idVal === 'number') {
    return idVal;
  }
  return String(idVal ?? '');
}

function stripMongoInternalFields<T>(doc: Document): T {
  const { _id: _omitId, _order: _omitOrder, ...rest } = doc;
  return rest as T;
}

async function replaceCollectionDocuments(
  db: Db,
  collectionName: string,
  records: Array<Record<string, unknown>>
): Promise<void> {
  const col = db.collection(collectionName);
  const ops: AnyBulkWriteOperation<Document>[] = [];
  const activeIds = records.map((r) => getRecordKey(r));

  for (let idx = 0; idx < records.length; idx++) {
    const rec = records[idx];
    const key = getRecordKey(rec);
    ops.push({
      replaceOne: {
        filter: { id: key },
        replacement: { ...rec, _order: idx },
        upsert: true,
      },
    });
  }

  if (ops.length > 0) {
    await col.bulkWrite(ops, { ordered: false });
  }

  if (activeIds.length > 0) {
    await col.deleteMany({ id: { $nin: activeIds } });
  } else {
    await col.deleteMany({});
  }
}

export async function loadDatabaseFromMongo(
  createSeedDb: () => Promise<DatabaseSchema>
): Promise<DatabaseSchema> {
  const db = await getMongoDatabase();
  const metaCol = db.collection<{ _id: string; version: number; seededAt: string }>(
    MONGO_COLLECTIONS.meta
  );

  const seedMarker = await metaCol.findOne({ _id: 'seed_v1' });
  if (!seedMarker) {
    const [prodCount, adminCount, orderCount] = await Promise.all([
      db.collection(MONGO_COLLECTIONS.products).countDocuments(),
      db.collection(MONGO_COLLECTIONS.adminUsers).countDocuments(),
      db.collection(MONGO_COLLECTIONS.orders).countDocuments(),
    ]);

    if (prodCount === 0 && adminCount === 0 && orderCount === 0) {
      const seedDb = await createSeedDb();
      await Promise.all(
        COLLECTION_KEYS.map(({ schemaKey, collectionName }) => {
          const list = Array.isArray(seedDb[schemaKey])
            ? (seedDb[schemaKey] as unknown as Array<Record<string, unknown>>)
            : [];
          return replaceCollectionDocuments(db, collectionName, list);
        })
      );
    }

    await metaCol.updateOne(
      { _id: 'seed_v1' },
      {
        $setOnInsert: {
          _id: 'seed_v1',
          version: 1,
          seededAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );
  }

  const results = await Promise.all(
    COLLECTION_KEYS.map(async ({ schemaKey, collectionName }) => {
      const docs = await db
        .collection(collectionName)
        .find({})
        .sort({ _order: 1 })
        .toArray();
      return {
        schemaKey,
        items: docs.map((d) => stripMongoInternalFields<unknown>(d)),
      };
    })
  );

  const purgeMeta = await db
    .collection<{ _id: string; lastPurgedAt?: string }>(MONGO_COLLECTIONS.meta)
    .findOne({ _id: 'purge_meta' });

  const assembled: Record<string, unknown> = { version: 1 };
  if (purgeMeta?.lastPurgedAt) {
    assembled.lastPurgedAt = purgeMeta.lastPurgedAt;
  }
  for (const { schemaKey, items } of results) {
    assembled[schemaKey] = items;
  }

  return assembled as unknown as DatabaseSchema;
}

export async function syncDatabaseToMongo(
  prevDb: DatabaseSchema | null,
  nextDb: DatabaseSchema
): Promise<void> {
  const db = await getMongoDatabase();

  const tasks: Promise<void>[] = [];

  for (const { schemaKey, collectionName } of COLLECTION_KEYS) {
    const prevList = Array.isArray(prevDb?.[schemaKey])
      ? (prevDb[schemaKey] as unknown as Array<Record<string, unknown>>)
      : null;
    const nextList = Array.isArray(nextDb[schemaKey])
      ? (nextDb[schemaKey] as unknown as Array<Record<string, unknown>>)
      : [];

    if (prevList !== null && JSON.stringify(prevList) === JSON.stringify(nextList)) {
      continue;
    }

    if (prevList === null) {
      tasks.push(replaceCollectionDocuments(db, collectionName, nextList));
      continue;
    }

    const col = db.collection(collectionName);
    const prevMap = new Map<string, { json: string; index: number }>();
    prevList.forEach((item, idx) => {
      prevMap.set(String(getRecordKey(item)), {
        json: JSON.stringify(item),
        index: idx,
      });
    });

    const ops: AnyBulkWriteOperation<Document>[] = [];
    const nextKeys = new Set<string>();
    const activeIds: Array<string | number> = [];

    for (let idx = 0; idx < nextList.length; idx++) {
      const item = nextList[idx];
      const key = getRecordKey(item);
      const keyStr = String(key);
      nextKeys.add(keyStr);
      activeIds.push(key);

      const prevEntry = prevMap.get(keyStr);
      const nextJson = JSON.stringify(item);
      if (!prevEntry || prevEntry.json !== nextJson || prevEntry.index !== idx) {
        ops.push({
          replaceOne: {
            filter: { id: key },
            replacement: { ...item, _order: idx },
            upsert: true,
          },
        });
      }
    }

    const deletedIds: Array<string | number> = [];
    for (const prevItem of prevList) {
      const key = getRecordKey(prevItem);
      if (!nextKeys.has(String(key))) {
        deletedIds.push(key);
      }
    }

    tasks.push(
      (async () => {
        if (ops.length > 0) {
          await col.bulkWrite(ops, { ordered: false });
        }
        if (deletedIds.length > 0) {
          await col.deleteMany({ id: { $in: deletedIds } });
        } else if (activeIds.length === 0 && prevList.length > 0) {
          await col.deleteMany({});
        }
      })()
    );
  }

  if (prevDb?.lastPurgedAt !== nextDb.lastPurgedAt && nextDb.lastPurgedAt) {
    tasks.push(
      db
        .collection<{ _id: string; lastPurgedAt: string }>(MONGO_COLLECTIONS.meta)
        .updateOne(
          { _id: 'purge_meta' },
          { $set: { lastPurgedAt: nextDb.lastPurgedAt } },
          { upsert: true }
        )
        .then(() => undefined)
    );
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}
