import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  ALL_ORDER_STATUSES,
  AdminNoteRecord,
  AdminNotificationRecord,
  AdminRole,
  AdminUserRecord,
  BrandRecord,
  CategoryRecord,
  DatabaseSchema,
  HeroBannerRecord,
  NotificationRecord,
  OrderItemRecord,
  OrderRecord,
  OrderStatus,
  OrderStatusHistoryRecord,
  PaymentRecord,
  ProductImageRecord,
  ProductRecord,
  ProductVariantRecord,
  RefundRecord,
  ReturnRecord,
  ShippingRecord,
  SupportMessageRecord,
  UserRecord,
} from './schema';
import {
  isMongoConfigured,
  loadDatabaseFromMongo,
  syncDatabaseToMongo,
} from './mongo';

export const DEFAULT_HERO_BANNERS: HeroBannerRecord[] = [
  {
    id: 'slide-1',
    image: '/images/Slide-1.png',
    alt: 'Kinetic Running Series',
    link: '/products?category=Running',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'slide-2',
    image: '/images/Slide-2.png',
    alt: 'Urban Casual Collection',
    link: '/products?category=Casual',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'slide-3',
    image: '/images/Slide-3.png',
    alt: 'High-Traction Sports Range',
    link: '/products?category=Sports',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function sanitizeStorefrontLink(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/products';
  }
  return trimmed.slice(0, 200);
}

function sanitizeBannerImage(raw: string, fallback: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed.slice(0, 300);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.slice(0, 500);
  }
  return fallback;
}

const BUNDLED_DATA_DIR = path.join(process.cwd(), 'src/lib/data');
const BUNDLED_DB_FILE_PATH = path.join(BUNDLED_DATA_DIR, 'database.json');
const PRODUCTS_FILE_PATH = path.join(BUNDLED_DATA_DIR, 'products.json');
const DEFAULT_PRODUCTS_FILE_PATH = path.join(BUNDLED_DATA_DIR, 'default-products.json');
const ORDERS_FILE_PATH = path.join(BUNDLED_DATA_DIR, 'orders.json');

const TMP_DATA_DIR = path.join(os.tmpdir(), 'stepstyle-data');
const TMP_DB_FILE_PATH = path.join(TMP_DATA_DIR, 'database.json');

// Serialize all database mutations through a single process-wide promise mutex
const globalForDb = globalThis as typeof globalThis & {
  __stepstyleDbMutex?: Promise<unknown>;
  __stepstyleDbCache?: DatabaseSchema;
  __stepstyleMongoCacheAt?: number;
  __stepstyleStorageTarget?: { dbPath: string; bundledWritable: boolean };
  __stepstyleMemoryFallbackActive?: boolean;
};

async function isDirectoryWritable(dirPath: string): Promise<boolean> {
  const probeFile = path.join(dirPath, `.probe-${process.pid}-${Date.now()}`);
  try {
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(probeFile, '');
    await fs.unlink(probeFile);
    return true;
  } catch {
    return false;
  }
}

async function resolveStorageTarget(): Promise<{ dbPath: string; bundledWritable: boolean }> {
  if (globalForDb.__stepstyleStorageTarget) {
    return globalForDb.__stepstyleStorageTarget;
  }

  const customDir = process.env.STEPSTYLE_DATA_DIR?.trim();
  if (customDir && (await isDirectoryWritable(customDir))) {
    const target = { dbPath: path.join(customDir, 'database.json'), bundledWritable: false };
    globalForDb.__stepstyleStorageTarget = target;
    return target;
  }

  if (await isDirectoryWritable(BUNDLED_DATA_DIR)) {
    const target = { dbPath: BUNDLED_DB_FILE_PATH, bundledWritable: true };
    globalForDb.__stepstyleStorageTarget = target;
    return target;
  }

  const target = { dbPath: TMP_DB_FILE_PATH, bundledWritable: false };
  globalForDb.__stepstyleStorageTarget = target;
  return target;
}

function runLocked<T>(fn: () => Promise<T>): Promise<T> {
  const current = globalForDb.__stepstyleDbMutex || Promise.resolve();
  const next = current.then(fn, fn);
  globalForDb.__stepstyleDbMutex = next.catch(() => undefined);
  return next;
}

export function hashPassword(password: string, existingSalt?: string): {
  hash: string;
  salt: string;
} {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
}

function normalizeOrderNumber(orderNumber: string): string {
  return orderNumber.trim().replace(/^#+/, '').toUpperCase();
}

export function generateUniqueOrderNumber(existing: Set<string>): string {
  for (let i = 0; i < 20; i++) {
    const candidate = `STEP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `STEP-${Date.now().toString().slice(-8)}`;
}

function mapLegacyStageToStatus(stage?: string, paymentStatus?: string): OrderStatus {
  switch (stage) {
    case 'placed':
      return 'Order Placed';
    case 'payment_confirmed':
      return 'Order Confirmed';
    case 'processing':
      return 'Processing';
    case 'packing':
      return 'Packed';
    case 'shipped':
      return 'Shipped';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
    default:
      return paymentStatus === 'PAID' ? 'Order Confirmed' : 'Order Placed';
  }
}

function mapStatusToLegacyStage(status: OrderStatus): string {
  switch (status) {
    case 'Order Placed':
      return 'placed';
    case 'Order Accepted':
    case 'Order Confirmed':
      return 'payment_confirmed';
    case 'Processing':
      return 'processing';
    case 'Packed':
      return 'packing';
    case 'Shipped':
      return 'shipped';
    case 'Out for Delivery':
      return 'out_for_delivery';
    case 'Delivered':
      return 'delivered';
    default:
      return 'processing';
  }
}

function mapPaymentStatusFromOrder(
  status: string
): 'Pending' | 'Paid' | 'Failed' | 'Refund Initiated' | 'Refunded' {
  const s = status.toLowerCase();
  if (s.includes('paid')) return 'Paid';
  if (s.includes('fail')) return 'Failed';
  if (s.includes('refunded')) return 'Refunded';
  if (s.includes('refund')) return 'Refund Initiated';
  return 'Pending';
}

async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeAtomicJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

async function syncLegacyFiles(db: DatabaseSchema): Promise<void> {
  // Keep src/lib/data/products.json synced for existing SSR storefront pages
  const storefrontProducts = db.products
    .filter((p) => !p.isDeleted)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      discountPercentage: p.discountPercentage,
      stockQuantity: p.stockQuantity,
      imagePath: p.imagePath,
      images: p.images,
      category: p.category,
      inStock: p.inStock && p.stockQuantity > 0,
      colors: p.colors,
      sizes: p.sizes,
      tags: p.tags,
      featured: p.featured,
      brand: p.brand,
      gender: p.gender,
      shoeType: p.shoeType,
      status: p.status,
      isDeleted: p.isDeleted,
      createdAt: p.createdAt,
    }));

  await writeAtomicJson(PRODUCTS_FILE_PATH, storefrontProducts);

  // Keep src/lib/data/orders.json synced for backward compatibility
  const legacyOrders = db.orders.map((o) => {
    const items = db.orderItems.filter((i) => i.orderId === o.id);
    const payment = db.payments.find((p) => p.orderId === o.id);
    const ship = db.shipping.find((s) => s.orderId === o.id);
    return {
      orderId: o.orderNumber,
      date: o.createdAt,
      items: items.map((i) => ({
        id: i.productId,
        name: i.name,
        price: i.unitPrice,
        quantity: i.quantity,
        selectedColor: i.selectedColor,
        selectedSize: i.selectedSize,
        imagePath: i.imagePath,
        brand: i.brand,
        category: i.category,
      })),
      totalAmount: o.totalAmount,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      transactionId: payment?.transactionId,
      utrNumber: payment?.utrNumber,
      paidToUPI: payment?.paidToUPI,
      customer: {
        name: o.customerName,
        phone: o.customerPhone,
        address: o.deliveryAddress,
        pincode: o.pincode,
        email: o.customerEmail,
      },
      estimatedDelivery: o.estimatedDelivery,
      stage: mapStatusToLegacyStage(o.status),
      status: o.status,
      carrier: ship?.carrier || 'BlueDart Express',
      trackingNumber: ship?.trackingNumber || `BD-IN-${o.orderNumber.replace(/\D/g, '').slice(-8)}`,
      updatedAt: o.updatedAt,
    };
  });

  await writeAtomicJson(ORDERS_FILE_PATH, legacyOrders);
}

async function persistDatabase(
  db: DatabaseSchema,
  storage: { dbPath: string; bundledWritable: boolean },
  prevDb: DatabaseSchema | null = null
): Promise<void> {
  if (isMongoConfigured()) {
    await syncDatabaseToMongo(prevDb, db);
    globalForDb.__stepstyleDbCache = db;
    globalForDb.__stepstyleMongoCacheAt = Date.now();
    globalForDb.__stepstyleMemoryFallbackActive = false;
    if (storage.bundledWritable) {
      try {
        await syncLegacyFiles(db);
      } catch {
        // Non-fatal if legacy sync fails
      }
    }
    return;
  }

  globalForDb.__stepstyleDbCache = db;
  let diskPersisted = false;
  try {
    await writeAtomicJson(storage.dbPath, db);
    diskPersisted = true;
  } catch (err) {
    // Fallback to temp path if primary became read-only
    if (storage.dbPath !== TMP_DB_FILE_PATH) {
      try {
        await writeAtomicJson(TMP_DB_FILE_PATH, db);
        globalForDb.__stepstyleStorageTarget = {
          dbPath: TMP_DB_FILE_PATH,
          bundledWritable: false,
        };
        diskPersisted = true;
      } catch {
        console.warn('Database persisted in memory fallback:', err);
      }
    } else {
      console.warn('Database persisted in memory fallback:', err);
    }
  }

  globalForDb.__stepstyleMemoryFallbackActive = !diskPersisted;

  if (storage.bundledWritable) {
    try {
      await syncLegacyFiles(db);
    } catch {
      // Non-fatal if legacy sync fails
    }
  }
}

function normalizeLoadedDatabaseDefaults(db: DatabaseSchema): DatabaseSchema {
  if (!Array.isArray(db.heroBanners) || db.heroBanners.length === 0) {
    db.heroBanners = DEFAULT_HERO_BANNERS.map((b) => ({ ...b }));
  }
  if (!Array.isArray(db.adminNotifications)) {
    db.adminNotifications = [];
  }
  if (!Array.isArray(db.supportMessages)) {
    db.supportMessages = [];
  }
  return db;
}

async function reconcileLegacyOrdersIntoDb(db: DatabaseSchema): Promise<boolean> {
  const rawOrders = await readJsonSafe<any[]>(ORDERS_FILE_PATH, []);
  if (!Array.isArray(rawOrders) || rawOrders.length === 0) return false;

  const existingNumbers = new Set(db.orders.map((o) => normalizeOrderNumber(o.orderNumber)));
  const purgeCutoffMs = db.lastPurgedAt ? new Date(db.lastPurgedAt).getTime() : 0;
  let changed = false;
  const now = new Date().toISOString();

  for (const ro of rawOrders) {
    if (!ro || !ro.orderId) continue;
    const orderNumber = normalizeOrderNumber(String(ro.orderId));
    if (!orderNumber || existingNumbers.has(orderNumber)) continue;

    const rawDateStr = String(ro.date || ro.updatedAt || '');
    const rawOrderMs = rawDateStr ? new Date(rawDateStr).getTime() : NaN;
    if (purgeCutoffMs > 0 && (!Number.isFinite(rawOrderMs) || rawOrderMs <= purgeCutoffMs)) {
      continue;
    }

    existingNumbers.add(orderNumber);
    changed = true;

    const orderInternalId = `ord-${slugify(orderNumber) || Date.now()}`;
    const cleanEmail = normalizeCustomerEmail(ro.customer?.email);
    const cleanPhoneRaw = String(ro.customer?.phone || 'N/A').trim();
    const cleanPhone10 = normalizeCustomerPhone10(cleanPhoneRaw);
    const cleanPhone = cleanPhone10 || cleanPhoneRaw || 'N/A';
    const cleanName = String(ro.customer?.name || 'Customer').trim() || 'Customer';
    const cleanAddress = String(ro.customer?.address || 'N/A').trim() || 'N/A';
    const cleanPincode = String(ro.customer?.pincode || 'N/A').trim() || 'N/A';
    const createdAt = String(ro.date || now);
    const updatedAt = String(ro.updatedAt || createdAt);

    let user = mergeDuplicateUsersInDb(db, cleanEmail, cleanPhone10);
    if (!user) {
      user = {
        id: `usr-${slugify(cleanEmail || cleanPhone || orderInternalId) || Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        defaultAddress: cleanAddress !== 'N/A' ? cleanAddress : undefined,
        defaultPincode: cleanPincode !== 'N/A' ? cleanPincode : undefined,
        createdAt,
        lastOrderAt: createdAt,
      };
      db.users.push(user);
    } else {
      if (
        cleanName !== 'Customer' &&
        (isPlaceholderCustomerName(user.name, user.email) || !user.name)
      ) {
        user.name = cleanName;
      }
      if (cleanEmail && !user.email) user.email = cleanEmail;
      if (cleanPhone !== 'N/A' && (!user.phone || user.phone === 'N/A')) {
        user.phone = cleanPhone;
      }
      if (
        !user.lastOrderAt ||
        new Date(createdAt).getTime() > new Date(user.lastOrderAt).getTime()
      ) {
        user.lastOrderAt = createdAt;
      }
      if (cleanAddress !== 'N/A' && (!user.defaultAddress || user.defaultAddress === 'N/A')) {
        user.defaultAddress = cleanAddress;
      }
      if (cleanPincode !== 'N/A' && (!user.defaultPincode || user.defaultPincode === 'N/A')) {
        user.defaultPincode = cleanPincode;
      }
    }

    const rawStatus = typeof ro.status === 'string' ? ro.status.trim() : '';
    const status: OrderStatus = ALL_ORDER_STATUSES.includes(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : mapLegacyStageToStatus(ro.stage, ro.paymentStatus);
    const payStatus = mapPaymentStatusFromOrder(String(ro.paymentStatus || ''));
    const totalAmount = Number(ro.totalAmount) || 0;
    const shippingFee = Number(ro.shippingFee) || 0;
    const subtotal = Math.max(0, totalAmount - shippingFee);

    const newOrder: OrderRecord = {
      id: orderInternalId,
      orderNumber,
      userId: user.id,
      customerName: cleanName,
      customerPhone: cleanPhone,
      customerEmail: cleanEmail,
      deliveryAddress: cleanAddress,
      pincode: cleanPincode,
      subtotal,
      shippingFee,
      totalAmount,
      status,
      paymentStatus: payStatus,
      paymentMethod: String(ro.paymentMethod || 'UPI'),
      stockDeducted: false,
      estimatedDelivery: String(ro.estimatedDelivery || 'Within 3-5 Business Days'),
      createdAt,
      updatedAt,
    };
    db.orders.push(newOrder);

    let totalPairs = 0;
    let firstItemName = 'Footwear';
    const rawItems = Array.isArray(ro.items) ? ro.items : [];
    rawItems.forEach((item: any, idx: number) => {
      const prod = db.products.find((p) => p.id === Number(item?.id));
      const qty = Math.max(1, Number(item?.quantity) || 1);
      const unitPrice = Number(item?.price) || prod?.price || 0;
      const itemName = String(item?.name || prod?.name || 'Footwear Item');
      if (idx === 0) firstItemName = itemName;
      totalPairs += qty;
      db.orderItems.push({
        id: `oi-${orderInternalId}-${idx + 1}`,
        orderId: orderInternalId,
        productId: Number(item?.id) || 0,
        sku: prod?.sku || `STEP-${String(item?.id || idx + 1).padStart(4, '0')}`,
        name: itemName,
        imagePath: String(item?.imagePath || prod?.imagePath || '/images/Empty-cart.jpg'),
        brand: String(item?.brand || prod?.brand || 'StepStyle'),
        category: String(item?.category || prod?.category || 'Sneakers'),
        selectedSize: item?.selectedSize ? Number(item.selectedSize) : undefined,
        selectedColor: item?.selectedColor ? String(item.selectedColor) : undefined,
        quantity: qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      });
    });

    db.orderStatusHistory.push({
      id: `hist-${orderInternalId}-1`,
      orderId: orderInternalId,
      status: 'Order Placed',
      note: 'Order created at checkout',
      updatedByAdminName: 'System',
      updatedByRole: 'Checkout',
      timestamp: createdAt,
    });

    if (status !== 'Order Placed') {
      db.orderStatusHistory.push({
        id: `hist-${orderInternalId}-2`,
        orderId: orderInternalId,
        status,
        previousStatus: 'Order Placed',
        note: payStatus === 'Paid' ? 'Payment verified' : 'Order recorded',
        updatedByAdminName: 'System',
        updatedByRole: 'System',
        timestamp: updatedAt,
      });
    }

    db.payments.push({
      id: `pay-${orderInternalId}`,
      orderId: orderInternalId,
      method: String(ro.paymentMethod || 'UPI'),
      status: payStatus,
      amount: totalAmount,
      transactionId: ro.transactionId ? String(ro.transactionId) : undefined,
      utrNumber: ro.utrNumber ? String(ro.utrNumber) : undefined,
      paidToUPI: ro.paidToUPI ? String(ro.paidToUPI) : undefined,
      paidAt: payStatus === 'Paid' ? createdAt : undefined,
      updatedAt: createdAt,
    });

    db.shipping.push({
      id: `ship-${orderInternalId}`,
      orderId: orderInternalId,
      carrier: String(ro.carrier || 'BlueDart Express'),
      trackingNumber: String(
        ro.trackingNumber || `BD-IN-${orderNumber.replace(/\D/g, '').slice(-8) || '84920194'}`
      ),
      estimatedDelivery: String(ro.estimatedDelivery || 'Within 3-5 Business Days'),
      updatedAt: createdAt,
    });

    pushAdminNotification(db, {
      type: 'new_order',
      orderId: orderInternalId,
      orderNumber,
      customerName: cleanName,
      customerPhone: cleanPhone,
      totalAmount,
      paymentMethod: String(ro.paymentMethod || 'UPI'),
      paymentStatus: payStatus,
      itemCount: Math.max(1, totalPairs),
      primaryItemName: firstItemName,
      message: `Order ${orderNumber} placed by ${cleanName} (₹${totalAmount.toLocaleString(
        'en-IN'
      )})`,
      createdAt,
    });
  }

  return changed;
}

async function buildSeedSchemaFromFiles(): Promise<DatabaseSchema> {
  const storage = await resolveStorageTarget();
  const primaryDb = await readJsonSafe<DatabaseSchema | null>(storage.dbPath, null);
  if (primaryDb && primaryDb.version === 1 && Array.isArray(primaryDb.products)) {
    normalizeLoadedDatabaseDefaults(primaryDb);
    await reconcileLegacyOrdersIntoDb(primaryDb);
    return primaryDb;
  }

  if (storage.dbPath !== BUNDLED_DB_FILE_PATH) {
    const bundledDb = await readJsonSafe<DatabaseSchema | null>(BUNDLED_DB_FILE_PATH, null);
    if (bundledDb && bundledDb.version === 1 && Array.isArray(bundledDb.products)) {
      normalizeLoadedDatabaseDefaults(bundledDb);
      await reconcileLegacyOrdersIntoDb(bundledDb);
      return bundledDb;
    }
  }

  return buildStarterDatabaseFromLegacyFiles();
}

async function bootstrapDatabase(forceFresh = false): Promise<DatabaseSchema> {
  if (isMongoConfigured()) {
    const cacheAge = Date.now() - (globalForDb.__stepstyleMongoCacheAt || 0);
    if (!forceFresh && globalForDb.__stepstyleDbCache && cacheAge < 1500) {
      return globalForDb.__stepstyleDbCache;
    }

    const mongoDb = normalizeLoadedDatabaseDefaults(
      await loadDatabaseFromMongo(() => buildSeedSchemaFromFiles())
    );
    globalForDb.__stepstyleDbCache = mongoDb;
    globalForDb.__stepstyleMongoCacheAt = Date.now();
    globalForDb.__stepstyleMemoryFallbackActive = false;
    return mongoDb;
  }

  // If previous writes fell back strictly to memory cache (e.g. read-only filesystem), do not overwrite with stale disk data
  if (globalForDb.__stepstyleMemoryFallbackActive && globalForDb.__stepstyleDbCache) {
    return globalForDb.__stepstyleDbCache;
  }

  const storage = await resolveStorageTarget();
  let existingDb = await readJsonSafe<DatabaseSchema | null>(storage.dbPath, null);

  // When running from read-only deployment (/var/task), hydrate initial state from bundled database.json
  if (!existingDb && storage.dbPath !== BUNDLED_DB_FILE_PATH) {
    if (globalForDb.__stepstyleDbCache) {
      await reconcileLegacyOrdersIntoDb(globalForDb.__stepstyleDbCache);
      return globalForDb.__stepstyleDbCache;
    }
    existingDb = await readJsonSafe<DatabaseSchema | null>(BUNDLED_DB_FILE_PATH, null);
    if (existingDb && existingDb.version === 1 && Array.isArray(existingDb.products)) {
      normalizeLoadedDatabaseDefaults(existingDb);
      await reconcileLegacyOrdersIntoDb(existingDb);
      await persistDatabase(existingDb, storage);
      return existingDb;
    }
  }

  if (existingDb && existingDb.version === 1 && Array.isArray(existingDb.products)) {
    normalizeLoadedDatabaseDefaults(existingDb);
    const reconciled = await reconcileLegacyOrdersIntoDb(existingDb);
    globalForDb.__stepstyleDbCache = existingDb;
    if (reconciled) {
      await persistDatabase(existingDb, storage);
    }
    return existingDb;
  }

  if (globalForDb.__stepstyleDbCache) {
    await reconcileLegacyOrdersIntoDb(globalForDb.__stepstyleDbCache);
    return globalForDb.__stepstyleDbCache;
  }

  const db = await buildStarterDatabaseFromLegacyFiles();
  await persistDatabase(db, storage);
  return db;
}

async function buildStarterDatabaseFromLegacyFiles(): Promise<DatabaseSchema> {

  const now = new Date().toISOString();
  const initialSuperPassword = process.env.SUPER_ADMIN_PASSWORD || 'Soyab@8830';
  const { hash: superHash, salt: superSalt } = hashPassword(initialSuperPassword);

  const adminUsers: AdminUserRecord[] = [
    {
      id: 'admin-soyab-super',
      name: 'Soyab Shaikh',
      email: 'soyxbshxikh@gmail.com',
      passwordHash: superHash,
      passwordSalt: superSalt,
      role: 'Super Admin',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  // Hydrate products from products.json (or default-products.json)
  let rawProducts = await readJsonSafe<any[]>(PRODUCTS_FILE_PATH, []);
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
    rawProducts = await readJsonSafe<any[]>(DEFAULT_PRODUCTS_FILE_PATH, []);
  }

  const categoriesMap = new Map<string, CategoryRecord>();
  const brandsMap = new Map<string, BrandRecord>();
  const products: ProductRecord[] = [];
  const productImages: ProductImageRecord[] = [];
  const productVariants: ProductVariantRecord[] = [];
  const usedSkus = new Set<string>();

  for (const raw of rawProducts) {
    if (!raw || !raw.id || !raw.name) continue;
    const catName = String(raw.category || 'Casual').trim();
    const catSlug = slugify(catName) || 'casual';
    if (!categoriesMap.has(catSlug)) {
      categoriesMap.set(catSlug, {
        id: `cat-${catSlug}`,
        name: catName,
        slug: catSlug,
        description: `${catName} footwear collection`,
        createdAt: now,
      });
    }

    const brandName = String(raw.brand || 'StepStyle').trim();
    const brandSlug = slugify(brandName) || 'stepstyle';
    if (!brandsMap.has(brandSlug)) {
      brandsMap.set(brandSlug, {
        id: `brand-${brandSlug}`,
        name: brandName,
        slug: brandSlug,
        createdAt: now,
      });
    }

    let sku = normalizeSku(raw.sku || `STEP-${String(raw.id).padStart(4, '0')}`);
    while (usedSkus.has(sku)) {
      sku = `${sku}-${Math.floor(10 + Math.random() * 89)}`;
    }
    usedSkus.add(sku);

    const price = Number(raw.price) || 1999;
    const mrp = Math.max(price, Number(raw.mrp) || Math.round(price * 1.25));
    const discountPercentage =
      mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const stockQuantity =
      typeof raw.stockQuantity === 'number'
        ? raw.stockQuantity
        : raw.inStock === false
        ? 0
        : 35;

    const imagesList: string[] =
      Array.isArray(raw.images) && raw.images.length > 0
        ? raw.images.filter(Boolean)
        : raw.imagePath
        ? [raw.imagePath]
        : ['/images/Empty-cart.jpg'];

    const sizesList: number[] =
      Array.isArray(raw.sizes) && raw.sizes.length > 0
        ? raw.sizes.map(Number).filter((n: number) => !isNaN(n))
        : [7, 8, 9, 10, 11];
    const colorsList: string[] =
      Array.isArray(raw.colors) && raw.colors.length > 0
        ? raw.colors.map(String)
        : ['Black/White'];

    const product: ProductRecord = {
      id: Number(raw.id),
      sku,
      name: String(raw.name).trim(),
      description: String(raw.description || '').trim(),
      price,
      mrp,
      discountPercentage,
      stockQuantity,
      categoryId: `cat-${catSlug}`,
      category: catName,
      brandId: `brand-${brandSlug}`,
      brand: brandName,
      imagePath: raw.imagePath || imagesList[0],
      images: imagesList,
      colors: colorsList,
      sizes: sizesList,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [catName, brandName],
      featured: Boolean(raw.featured),
      inStock: stockQuantity > 0 && raw.inStock !== false,
      status: raw.status === 'inactive' ? 'inactive' : 'active',
      gender:
        raw.gender === 'Women' || raw.gender === 'Unisex' || raw.gender === 'Kids'
          ? raw.gender
          : 'Men',
      shoeType: String(raw.shoeType || catName || 'Sneakers'),
      isDeleted: Boolean(raw.isDeleted),
      createdAt: raw.createdAt || now,
      updatedAt: now,
    };
    products.push(product);

    imagesList.forEach((url, idx) => {
      productImages.push({
        id: `img-${product.id}-${idx + 1}`,
        productId: product.id,
        url,
        isPrimary: idx === 0,
        sortOrder: idx,
        createdAt: now,
      });
    });

    const perVariantStock = Math.max(
      1,
      Math.floor(stockQuantity / Math.max(1, sizesList.length * colorsList.length))
    );
    for (const size of sizesList) {
      for (const color of colorsList) {
        productVariants.push({
          id: `var-${product.id}-${size}-${slugify(color)}`,
          productId: product.id,
          sku: `${sku}-${size}-${slugify(color).toUpperCase().slice(0, 4)}`,
          size,
          color,
          stockQuantity: stockQuantity > 0 ? perVariantStock : 0,
        });
      }
    }
  }

  // Hydrate existing orders from orders.json
  const rawOrders = await readJsonSafe<any[]>(ORDERS_FILE_PATH, []);
  const usersMap = new Map<string, UserRecord>();
  const orders: OrderRecord[] = [];
  const orderItems: OrderItemRecord[] = [];
  const orderStatusHistory: OrderStatusHistoryRecord[] = [];
  const payments: PaymentRecord[] = [];
  const shipping: ShippingRecord[] = [];
  const notifications: NotificationRecord[] = [];

  for (const ro of Array.isArray(rawOrders) ? rawOrders : []) {
    if (!ro || !ro.orderId) continue;
    const orderNumber = normalizeOrderNumber(ro.orderId);
    const orderInternalId = `ord-${slugify(orderNumber)}`;
    const customerEmail = (ro.customer?.email || '').trim().toLowerCase();
    const customerPhone = (ro.customer?.phone || 'N/A').trim();
    const userKey = customerEmail || customerPhone || `guest-${orderInternalId}`;

    if (!usersMap.has(userKey)) {
      usersMap.set(userKey, {
        id: `usr-${slugify(userKey) || Date.now()}`,
        name: ro.customer?.name || 'Customer',
        email: customerEmail,
        phone: customerPhone,
        defaultAddress: ro.customer?.address,
        defaultPincode: ro.customer?.pincode,
        createdAt: ro.date || now,
        lastOrderAt: ro.date || now,
      });
    }
    const user = usersMap.get(userKey)!;

    const rawStatus = typeof ro.status === 'string' ? ro.status.trim() : '';
    const status: OrderStatus = ALL_ORDER_STATUSES.includes(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : mapLegacyStageToStatus(ro.stage, ro.paymentStatus);
    const payStatus = mapPaymentStatusFromOrder(ro.paymentStatus || '');
    const createdAt = ro.date || now;

    orders.push({
      id: orderInternalId,
      orderNumber,
      userId: user.id,
      customerName: ro.customer?.name || 'Customer',
      customerPhone,
      customerEmail,
      deliveryAddress: ro.customer?.address || 'N/A',
      pincode: ro.customer?.pincode || 'N/A',
      subtotal: Number(ro.totalAmount) || 0,
      shippingFee: 0,
      totalAmount: Number(ro.totalAmount) || 0,
      status,
      paymentStatus: payStatus,
      paymentMethod: ro.paymentMethod || 'UPI',
      stockDeducted: false,
      estimatedDelivery: ro.estimatedDelivery || 'Within 3-5 Business Days',
      createdAt,
      updatedAt: ro.updatedAt || createdAt,
    });

    for (const [idx, item] of (Array.isArray(ro.items) ? ro.items : []).entries()) {
      const prod = products.find((p) => p.id === Number(item.id));
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.price) || prod?.price || 0;
      orderItems.push({
        id: `oi-${orderInternalId}-${idx + 1}`,
        orderId: orderInternalId,
        productId: Number(item.id) || 0,
        sku: prod?.sku || `STEP-${String(item.id || idx + 1).padStart(4, '0')}`,
        name: item.name || prod?.name || 'Footwear Item',
        imagePath: item.imagePath || prod?.imagePath || '/images/Empty-cart.jpg',
        brand: item.brand || prod?.brand || 'StepStyle',
        category: item.category || prod?.category || 'Sneakers',
        selectedSize: item.selectedSize ? Number(item.selectedSize) : undefined,
        selectedColor: item.selectedColor,
        quantity: qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      });
    }

    orderStatusHistory.push({
      id: `hist-${orderInternalId}-1`,
      orderId: orderInternalId,
      status: 'Order Placed',
      note: 'Order created at checkout',
      updatedByAdminName: 'System',
      updatedByRole: 'Checkout',
      timestamp: createdAt,
    });

    if (status !== 'Order Placed') {
      orderStatusHistory.push({
        id: `hist-${orderInternalId}-2`,
        orderId: orderInternalId,
        status,
        previousStatus: 'Order Placed',
        note: payStatus === 'Paid' ? 'Payment verified' : 'Order recorded',
        updatedByAdminName: 'System',
        updatedByRole: 'System',
        timestamp: ro.updatedAt || createdAt,
      });
    }

    payments.push({
      id: `pay-${orderInternalId}`,
      orderId: orderInternalId,
      method: ro.paymentMethod || 'UPI',
      status: payStatus,
      amount: Number(ro.totalAmount) || 0,
      transactionId: ro.transactionId,
      utrNumber: ro.utrNumber,
      paidToUPI: ro.paidToUPI,
      paidAt: payStatus === 'Paid' ? createdAt : undefined,
      updatedAt: createdAt,
    });

    shipping.push({
      id: `ship-${orderInternalId}`,
      orderId: orderInternalId,
      carrier: ro.carrier || 'BlueDart Express',
      trackingNumber:
        ro.trackingNumber || `BD-IN-${orderNumber.replace(/\D/g, '').slice(-8) || '84920194'}`,
      estimatedDelivery: ro.estimatedDelivery || 'Within 3-5 Business Days',
      updatedAt: createdAt,
    });
  }

  const db: DatabaseSchema = {
    version: 1,
    users: Array.from(usersMap.values()),
    adminUsers,
    categories: Array.from(categoriesMap.values()),
    brands: Array.from(brandsMap.values()),
    products,
    productImages,
    productVariants,
    orders,
    orderItems,
    orderStatusHistory,
    payments,
    shipping,
    returns: [],
    refunds: [],
    adminNotes: [],
    notifications,
    adminNotifications: [],
    heroBanners: DEFAULT_HERO_BANNERS.map((b) => ({ ...b })),
    supportMessages: [],
  };

  return db;
}

export async function getDatabase(forceFresh = false): Promise<DatabaseSchema> {
  return runLocked(() => bootstrapDatabase(forceFresh));
}

export async function withTransaction<T>(
  mutator: (db: DatabaseSchema) => Promise<T> | T
): Promise<T> {
  return runLocked(async () => {
    const db = await bootstrapDatabase(true);
    const storage = await resolveStorageTarget();
    // Clone to preserve rollback safety on thrown errors
    const workingCopy = JSON.parse(JSON.stringify(db)) as DatabaseSchema;
    const result = await mutator(workingCopy);
    await persistDatabase(workingCopy, storage, db);
    return result;
  });
}

// ---------- Admin Auth Operations ----------

export async function getAdminUsersFromDb(): Promise<
  Array<Omit<AdminUserRecord, 'passwordHash' | 'passwordSalt'>>
> {
  const db = await getDatabase();
  return db.adminUsers.map(({ passwordHash: _h, passwordSalt: _s, ...safe }) => safe);
}

export async function getAdminUserById(id: string): Promise<AdminUserRecord | null> {
  const db = await getDatabase();
  return db.adminUsers.find((u) => u.id === id) || null;
}

export async function authenticateAdminInDb(
  emailInput: string,
  passwordInput: string
): Promise<
  | { success: true; user: Omit<AdminUserRecord, 'passwordHash' | 'passwordSalt'> }
  | { success: false; error: string }
> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPassword = passwordInput;
  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Email and password are required.' };
  }

  return withTransaction((db) => {
    const idx = db.adminUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (idx === -1) {
      return { success: false, error: 'Invalid administrator email or password.' };
    }

    const user = db.adminUsers[idx];
    if (user.status !== 'active') {
      return {
        success: false,
        error: 'This administrator account is disabled. Contact a Super Admin.',
      };
    }

    const envOverride =
      user.id === 'admin-soyab-super' && process.env.SUPER_ADMIN_PASSWORD
        ? cleanPassword === process.env.SUPER_ADMIN_PASSWORD
        : false;

    const valid = envOverride || verifyPassword(cleanPassword, user.passwordHash, user.passwordSalt);
    if (!valid) {
      return { success: false, error: 'Invalid administrator email or password.' };
    }

    db.adminUsers[idx].lastLogin = new Date().toISOString();
    const { passwordHash: _h, passwordSalt: _s, ...safeUser } = db.adminUsers[idx];
    return { success: true, user: safeUser };
  });
}

export async function registerAdminInDb(params: {
  name: string;
  email: string;
  password: string;
  role?: AdminRole;
}): Promise<
  | { success: true; user: Omit<AdminUserRecord, 'passwordHash' | 'passwordSalt'> }
  | { success: false; error: string }
> {
  const cleanName = params.name.trim();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPassword = params.password;
  if (cleanName.length < 2) {
    return { success: false, error: 'Please provide a valid full name.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Please provide a valid email address.' };
  }
  if (cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  return withTransaction((db) => {
    if (db.adminUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return {
        success: false,
        error: 'An administrator account already exists with this email.',
      };
    }

    const { hash, salt } = hashPassword(cleanPassword);
    const now = new Date().toISOString();
    const newAdmin: AdminUserRecord = {
      id: `admin-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: hash,
      passwordSalt: salt,
      role: params.role || 'Catalog Manager',
      status: 'active',
      createdAt: now,
      lastLogin: now,
    };

    db.adminUsers.push(newAdmin);
    const { passwordHash: _h, passwordSalt: _s, ...safeUser } = newAdmin;
    return { success: true, user: safeUser };
  });
}

// ---------- Category & Brand Helpers ----------

function ensureCategoryAndBrand(
  db: DatabaseSchema,
  categoryName: string,
  brandName: string
): { categoryId: string; brandId: string; category: string; brand: string } {
  const now = new Date().toISOString();
  const cleanCat = categoryName.trim() || 'Casual';
  const catSlug = slugify(cleanCat) || 'casual';
  let cat = db.categories.find((c) => c.slug === catSlug);
  if (!cat) {
    cat = {
      id: `cat-${catSlug}`,
      name: cleanCat,
      slug: catSlug,
      description: `${cleanCat} footwear`,
      createdAt: now,
    };
    db.categories.push(cat);
  }

  const cleanBrand = brandName.trim() || 'StepStyle';
  const brandSlug = slugify(cleanBrand) || 'stepstyle';
  let brand = db.brands.find((b) => b.slug === brandSlug);
  if (!brand) {
    brand = {
      id: `brand-${brandSlug}`,
      name: cleanBrand,
      slug: brandSlug,
      createdAt: now,
    };
    db.brands.push(brand);
  }

  return {
    categoryId: cat.id,
    brandId: brand.id,
    category: cat.name,
    brand: brand.name,
  };
}

function rebuildProductRelations(
  db: DatabaseSchema,
  product: ProductRecord,
  options?: { preserveExisting?: boolean }
): void {
  const now = new Date().toISOString();
  db.productImages = db.productImages.filter((img) => img.productId !== product.id);
  product.images.forEach((url, idx) => {
    db.productImages.push({
      id: `img-${product.id}-${idx + 1}`,
      productId: product.id,
      url,
      isPrimary: idx === 0,
      sortOrder: idx,
      createdAt: now,
    });
  });

  const existingVariants = db.productVariants.filter((v) => v.productId === product.id);
  db.productVariants = db.productVariants.filter((v) => v.productId !== product.id);

  const pairs: Array<{ size: number; color: string }> = [];
  for (const size of product.sizes) {
    for (const color of product.colors) {
      pairs.push({ size, color });
    }
  }

  if (pairs.length === 0) return;

  if (options?.preserveExisting && existingVariants.length > 0) {
    const existingMap = new Map<string, number>();
    for (const ev of existingVariants) {
      existingMap.set(`${ev.size}::${ev.color.toLowerCase()}`, Math.max(0, ev.stockQuantity));
    }
    const allMatched = pairs.every((p) => existingMap.has(`${p.size}::${p.color.toLowerCase()}`));
    if (allMatched && pairs.length === existingVariants.length) {
      for (const { size, color } of pairs) {
        db.productVariants.push({
          id: `var-${product.id}-${size}-${slugify(color)}`,
          productId: product.id,
          sku: `${product.sku}-${size}-${slugify(color).toUpperCase().slice(0, 4)}`,
          size,
          color,
          stockQuantity: existingMap.get(`${size}::${color.toLowerCase()}`) ?? 0,
        });
      }
      return;
    }
  }

  const totalStock = Math.max(0, Math.floor(product.stockQuantity || 0));
  const baseQty = Math.floor(totalStock / pairs.length);
  const remainder = totalStock % pairs.length;

  pairs.forEach(({ size, color }, idx) => {
    const qty = totalStock > 0 ? baseQty + (idx < remainder ? 1 : 0) : 0;
    db.productVariants.push({
      id: `var-${product.id}-${size}-${slugify(color)}`,
      productId: product.id,
      sku: `${product.sku}-${size}-${slugify(color).toUpperCase().slice(0, 4)}`,
      size,
      color,
      stockQuantity: qty,
    });
  });
}

// ---------- Product Operations ----------

export async function getProductsFromDb(includeInactive = true): Promise<ProductRecord[]> {
  const db = await getDatabase();
  return db.products.filter(
    (p) => !p.isDeleted && (includeInactive || p.status !== 'inactive')
  );
}

export async function createProductInDb(
  input: Partial<ProductRecord> & { name: string; price: number }
): Promise<ProductRecord> {
  return withTransaction((db) => {
    const now = new Date().toISOString();
    const nextId =
      db.products.length > 0 ? Math.max(...db.products.map((p) => p.id || 0)) + 1 : 1;

    const existingSkus = new Set(
      db.products.filter((p) => !p.isDeleted).map((p) => normalizeSku(p.sku))
    );
    let sku = input.sku
      ? normalizeSku(input.sku)
      : `STEP-${String(nextId).padStart(4, '0')}`;
    if (existingSkus.has(sku)) {
      if (input.sku) {
        throw new Error(`Duplicate SKU "${sku}" already exists in catalog.`);
      }
      sku = `${sku}-${Math.floor(100 + Math.random() * 899)}`;
    }

    const { categoryId, brandId, category, brand } = ensureCategoryAndBrand(
      db,
      input.category || 'Casual',
      input.brand || 'StepStyle'
    );

    const price = Number(input.price);
    const mrp = Math.max(price, Number(input.mrp) || Math.round(price * 1.25));
    const discountPercentage =
      typeof input.discountPercentage === 'number'
        ? input.discountPercentage
        : mrp > price
        ? Math.round(((mrp - price) / mrp) * 100)
        : 0;
    const stockQuantity =
      typeof input.stockQuantity === 'number'
        ? Math.max(0, Math.floor(input.stockQuantity))
        : input.inStock === false
        ? 0
        : 25;

    const images =
      Array.isArray(input.images) && input.images.length > 0
        ? input.images.filter(Boolean)
        : input.imagePath
        ? [input.imagePath]
        : ['/images/Empty-cart.jpg'];

    const newProduct: ProductRecord = {
      id: nextId,
      sku,
      name: input.name.trim(),
      description: (input.description || '').trim(),
      price,
      mrp,
      discountPercentage,
      stockQuantity,
      categoryId,
      category,
      brandId,
      brand,
      imagePath: input.imagePath || images[0],
      images,
      colors:
        Array.isArray(input.colors) && input.colors.length > 0
          ? input.colors
          : ['Black/White'],
      sizes:
        Array.isArray(input.sizes) && input.sizes.length > 0
          ? input.sizes.map(Number)
          : [7, 8, 9, 10, 11],
      tags: Array.isArray(input.tags) ? input.tags : [category, brand],
      featured: Boolean(input.featured),
      inStock: stockQuantity > 0 && input.inStock !== false,
      status: input.status === 'inactive' ? 'inactive' : 'active',
      gender: input.gender || 'Men',
      shoeType: input.shoeType || category,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    db.products.unshift(newProduct);
    rebuildProductRelations(db, newProduct);
    return newProduct;
  });
}

export async function updateProductInDb(
  id: number,
  updates: Partial<ProductRecord>
): Promise<ProductRecord | null> {
  return withTransaction((db) => {
    const idx = db.products.findIndex((p) => p.id === id && !p.isDeleted);
    if (idx === -1) return null;

    const current = db.products[idx];
    const nextSku = updates.sku ? normalizeSku(updates.sku) : current.sku;
    if (
      updates.sku &&
      db.products.some(
        (p) => p.id !== id && !p.isDeleted && normalizeSku(p.sku) === nextSku
      )
    ) {
      throw new Error(`Duplicate SKU "${nextSku}" is already assigned to another shoe.`);
    }

    const { categoryId, brandId, category, brand } = ensureCategoryAndBrand(
      db,
      updates.category ?? current.category,
      updates.brand ?? current.brand
    );

    const price = updates.price !== undefined ? Number(updates.price) : current.price;
    const mrp =
      updates.mrp !== undefined ? Math.max(price, Number(updates.mrp)) : Math.max(price, current.mrp);
    const discountPercentage =
      mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

    let stockQuantity = current.stockQuantity;
    if (typeof updates.stockQuantity === 'number') {
      stockQuantity = Math.max(0, Math.floor(updates.stockQuantity));
    } else if (updates.inStock !== undefined) {
      stockQuantity = updates.inStock ? Math.max(1, current.stockQuantity || 20) : 0;
    }

    const inStock =
      updates.inStock !== undefined
        ? Boolean(updates.inStock) && stockQuantity > 0
        : stockQuantity > 0;

    const images =
      Array.isArray(updates.images) && updates.images.length > 0
        ? updates.images.filter(Boolean)
        : current.images;

    const updated: ProductRecord = {
      ...current,
      ...updates,
      id,
      sku: nextSku,
      categoryId,
      category,
      brandId,
      brand,
      price,
      mrp,
      discountPercentage,
      stockQuantity,
      inStock,
      images,
      imagePath: updates.imagePath || images[0] || current.imagePath,
      updatedAt: new Date().toISOString(),
    };

    db.products[idx] = updated;
    const stockChanged =
      updates.stockQuantity !== undefined ||
      updates.inStock !== undefined ||
      updates.sizes !== undefined ||
      updates.colors !== undefined;
    rebuildProductRelations(db, updated, { preserveExisting: !stockChanged });
    return updated;
  });
}

export async function deleteProductInDb(id: number): Promise<boolean> {
  return withTransaction((db) => {
    const before = db.products.length;
    db.products = db.products.filter((p) => p.id !== id);
    db.productImages = db.productImages.filter((img) => img.productId !== id);
    db.productVariants = db.productVariants.filter((v) => v.productId !== id);
    return db.products.length < before;
  });
}

export interface BulkImportRowInput {
  rowNumber: number;
  name: string;
  sku: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  mrp: number;
  discountPercentage: number;
  stockQuantity: number;
  sizes: number[];
  colors: string[];
  imagePath: string;
  additionalImages: string[];
  tags: string[];
  featured: boolean;
  status: 'active' | 'inactive';
  gender: 'Men' | 'Women' | 'Unisex' | 'Kids';
  shoeType: string;
  missingImage?: boolean;
}

export async function bulkImportProductsTransactional(rows: BulkImportRowInput[]): Promise<{
  totalRows: number;
  successfullyImported: number;
  failedRows: number;
  duplicateSkus: Array<{ rowNumber: number; sku: string; name: string; reason: string }>;
  missingImages: Array<{ rowNumber: number; sku: string; name: string; imageRef: string }>;
  invalidData: Array<{ rowNumber: number; sku: string; name: string; error: string }>;
  importedProducts: ProductRecord[];
}> {
  return withTransaction((db) => {
    const now = new Date().toISOString();
    const existingSkus = new Set(
      db.products.filter((p) => !p.isDeleted).map((p) => normalizeSku(p.sku))
    );

    let nextId =
      db.products.length > 0 ? Math.max(...db.products.map((p) => p.id || 0)) + 1 : 1;

    const duplicateSkus: Array<{ rowNumber: number; sku: string; name: string; reason: string }> = [];
    const missingImages: Array<{ rowNumber: number; sku: string; name: string; imageRef: string }> = [];
    const invalidData: Array<{ rowNumber: number; sku: string; name: string; error: string }> = [];
    const importedProducts: ProductRecord[] = [];

    for (const row of rows) {
      const cleanName = (row.name || '').trim();
      const cleanSku = normalizeSku(row.sku || '');

      if (!cleanName || !cleanSku || isNaN(row.price) || row.price <= 0) {
        invalidData.push({
          rowNumber: row.rowNumber,
          sku: row.sku || '',
          name: cleanName || 'Unnamed',
          error: 'Missing required Product Name, SKU, or valid Price > 0.',
        });
        continue;
      }

      if (existingSkus.has(cleanSku)) {
        duplicateSkus.push({
          rowNumber: row.rowNumber,
          sku: cleanSku,
          name: cleanName,
          reason: `SKU "${cleanSku}" already exists in catalog or earlier in this batch.`,
        });
        continue;
      }

      if (row.missingImage) {
        missingImages.push({
          rowNumber: row.rowNumber,
          sku: cleanSku,
          name: cleanName,
          imageRef: row.imagePath || 'No image provided',
        });
      }

      const mrp = Math.max(row.price, row.mrp || row.price);
      const discountPercentage =
        row.discountPercentage > 0
          ? Math.min(95, row.discountPercentage)
          : mrp > row.price
          ? Math.round(((mrp - row.price) / mrp) * 100)
          : 0;

      const { categoryId, brandId, category, brand } = ensureCategoryAndBrand(
        db,
        row.category || 'Casual',
        row.brand || 'StepStyle'
      );

      const primaryImg = row.imagePath && !row.missingImage ? row.imagePath : '/images/Empty-cart.jpg';
      const allImgs = [
        primaryImg,
        ...row.additionalImages.filter((u) => u && u !== primaryImg),
      ];

      const stockQty = Math.max(0, Math.floor(row.stockQuantity ?? 25));

      const product: ProductRecord = {
        id: nextId++,
        sku: cleanSku,
        name: cleanName,
        description:
          (row.description || '').trim() ||
          `${cleanName} crafted by ${brand} for ${category.toLowerCase()} comfort and durability.`,
        price: Math.round(row.price),
        mrp: Math.round(mrp),
        discountPercentage,
        stockQuantity: stockQty,
        categoryId,
        category,
        brandId,
        brand,
        imagePath: primaryImg,
        images: allImgs,
        colors: row.colors.length > 0 ? row.colors : ['Black/White'],
        sizes: row.sizes.length > 0 ? row.sizes : [7, 8, 9, 10, 11],
        tags: row.tags.length > 0 ? row.tags : [category, brand],
        featured: Boolean(row.featured),
        inStock: stockQty > 0,
        status: row.status === 'inactive' ? 'inactive' : 'active',
        gender: row.gender || 'Men',
        shoeType: row.shoeType || category,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      existingSkus.add(cleanSku);
      db.products.unshift(product);
      rebuildProductRelations(db, product);
      importedProducts.push(product);
    }

    return {
      totalRows: rows.length,
      successfullyImported: importedProducts.length,
      failedRows: duplicateSkus.length + invalidData.length,
      duplicateSkus,
      missingImages,
      invalidData,
      importedProducts,
    };
  });
}

export type BulkProductActionPayload =
  | { action: 'bulk_edit_price'; ids: number[]; mode: 'fixed' | 'percent_increase' | 'percent_decrease'; value: number }
  | { action: 'bulk_update_stock'; ids: number[]; stockQuantity: number }
  | { action: 'bulk_activate'; ids: number[] }
  | { action: 'bulk_deactivate'; ids: number[] }
  | { action: 'bulk_delete'; ids: number[] }
  | { action: 'bulk_assign_category'; ids: number[]; category: string }
  | { action: 'bulk_assign_brand'; ids: number[]; brand: string }
  | { action: 'bulk_update_discount'; ids: number[]; discountPercentage: number };

export async function bulkMutateProductsTransactional(
  payload: BulkProductActionPayload
): Promise<{ affectedCount: number }> {
  return withTransaction((db) => {
    const idSet = new Set(payload.ids.map(Number));
    const now = new Date().toISOString();
    let affectedCount = 0;

    if (payload.action === 'bulk_delete') {
      const before = db.products.length;
      db.products = db.products.filter((p) => !idSet.has(p.id));
      db.productImages = db.productImages.filter((img) => !idSet.has(img.productId));
      db.productVariants = db.productVariants.filter((v) => !idSet.has(v.productId));
      return { affectedCount: before - db.products.length };
    }

    db.products = db.products.map((product) => {
      if (!idSet.has(product.id) || product.isDeleted) return product;
      affectedCount++;
      let updated = { ...product, updatedAt: now };

      switch (payload.action) {
        case 'bulk_edit_price': {
          const val = Number(payload.value) || 0;
          let nextPrice = updated.price;
          if (payload.mode === 'fixed' && val > 0) nextPrice = Math.round(val);
          else if (payload.mode === 'percent_increase')
            nextPrice = Math.max(1, Math.round(updated.price * (1 + val / 100)));
          else if (payload.mode === 'percent_decrease')
            nextPrice = Math.max(1, Math.round(updated.price * (1 - val / 100)));

          const nextMrp = Math.max(nextPrice, updated.mrp);
          updated.price = nextPrice;
          updated.mrp = nextMrp;
          updated.discountPercentage =
            nextMrp > nextPrice ? Math.round(((nextMrp - nextPrice) / nextMrp) * 100) : 0;
          break;
        }
        case 'bulk_update_stock': {
          const qty = Math.max(0, Math.floor(Number(payload.stockQuantity) || 0));
          updated.stockQuantity = qty;
          updated.inStock = qty > 0;
          rebuildProductRelations(db, updated);
          break;
        }
        case 'bulk_activate':
          updated.status = 'active';
          break;
        case 'bulk_deactivate':
          updated.status = 'inactive';
          break;
        case 'bulk_assign_category': {
          const rel = ensureCategoryAndBrand(db, payload.category, updated.brand);
          updated.categoryId = rel.categoryId;
          updated.category = rel.category;
          break;
        }
        case 'bulk_assign_brand': {
          const rel = ensureCategoryAndBrand(db, updated.category, payload.brand);
          updated.brandId = rel.brandId;
          updated.brand = rel.brand;
          break;
        }
        case 'bulk_update_discount': {
          const disc = Math.max(0, Math.min(90, Number(payload.discountPercentage) || 0));
          const baseMrp = Math.max(updated.mrp || updated.price, updated.price);
          updated.mrp = baseMrp;
          updated.discountPercentage = disc;
          updated.price = Math.max(1, Math.round(baseMrp * (1 - disc / 100)));
          break;
        }
      }

      return updated;
    });

    return { affectedCount };
  });
}

// ---------- Stock Management Helpers ----------

function findMatchingVariantIndex(
  variants: ProductVariantRecord[],
  productId: number,
  selectedSize?: number,
  selectedColor?: string
): number {
  if (selectedSize === undefined) return -1;
  if (selectedColor) {
    const exact = variants.findIndex(
      (v) =>
        v.productId === productId &&
        v.size === selectedSize &&
        v.color.toLowerCase() === selectedColor.toLowerCase()
    );
    if (exact >= 0) return exact;
  }
  return variants.findIndex((v) => v.productId === productId && v.size === selectedSize);
}

function applyStockDeduction(db: DatabaseSchema, order: OrderRecord): void {
  if (order.stockDeducted) return;
  const items = db.orderItems.filter((i) => i.orderId === order.id);
  for (const item of items) {
    const prodIdx = db.products.findIndex((p) => p.id === item.productId);
    if (prodIdx >= 0) {
      const nextStock = Math.max(0, db.products[prodIdx].stockQuantity - item.quantity);
      db.products[prodIdx].stockQuantity = nextStock;
      db.products[prodIdx].inStock = nextStock > 0;
      db.products[prodIdx].updatedAt = new Date().toISOString();
    }
    const varIdx = findMatchingVariantIndex(
      db.productVariants,
      item.productId,
      item.selectedSize,
      item.selectedColor
    );
    if (varIdx >= 0) {
      db.productVariants[varIdx].stockQuantity = Math.max(
        0,
        db.productVariants[varIdx].stockQuantity - item.quantity
      );
    }
  }
  order.stockDeducted = true;
}

function applyStockRestoration(db: DatabaseSchema, order: OrderRecord): void {
  if (!order.stockDeducted) return;
  const items = db.orderItems.filter((i) => i.orderId === order.id);
  for (const item of items) {
    const prodIdx = db.products.findIndex((p) => p.id === item.productId);
    if (prodIdx >= 0) {
      const nextStock = db.products[prodIdx].stockQuantity + item.quantity;
      db.products[prodIdx].stockQuantity = nextStock;
      db.products[prodIdx].inStock = nextStock > 0;
      db.products[prodIdx].updatedAt = new Date().toISOString();
    }
    const varIdx = findMatchingVariantIndex(
      db.productVariants,
      item.productId,
      item.selectedSize,
      item.selectedColor
    );
    if (varIdx >= 0) {
      db.productVariants[varIdx].stockQuantity += item.quantity;
    }
  }
  order.stockDeducted = false;
}

function createOrderNotifications(
  db: DatabaseSchema,
  order: OrderRecord,
  shipping: ShippingRecord | undefined,
  status: OrderStatus,
  note?: string
): void {
  const now = new Date().toISOString();
  const trackingSummary = shipping?.trackingNumber
    ? ` Tracking: ${shipping.carrier} (${shipping.trackingNumber}).`
    : '';
  const msg = `Hi ${order.customerName}, your order ${order.orderNumber} is now "${status}".${trackingSummary}${
    note ? ` Note: ${note}` : ''
  }`;
  const subject = `StepStyle Order ${order.orderNumber} — ${status}`;

  const channels: Array<'website' | 'email' | 'whatsapp'> = ['website'];
  if (order.customerEmail) channels.push('email');
  if (order.customerPhone && order.customerPhone !== 'N/A') channels.push('whatsapp');

  for (const channel of channels) {
    db.notifications.unshift({
      id: `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail || undefined,
      customerPhone: order.customerPhone !== 'N/A' ? order.customerPhone : undefined,
      channel,
      status,
      subject,
      message: msg,
      trackingNumber: shipping?.trackingNumber,
      carrier: shipping?.carrier,
      sentAt: now,
    });
  }
}

function pushAdminNotification(
  db: DatabaseSchema,
  entry: Omit<AdminNotificationRecord, 'id' | 'isRead' | 'createdAt'> & {
    createdAt?: string;
  }
): AdminNotificationRecord {
  if (!Array.isArray(db.adminNotifications)) {
    db.adminNotifications = [];
  }
  const record: AdminNotificationRecord = {
    id: `adm-notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    type: entry.type,
    orderId: entry.orderId,
    orderNumber: entry.orderNumber,
    customerName: entry.customerName,
    customerPhone: entry.customerPhone,
    totalAmount: entry.totalAmount,
    paymentMethod: entry.paymentMethod,
    paymentStatus: entry.paymentStatus,
    itemCount: entry.itemCount,
    primaryItemName: entry.primaryItemName,
    message: entry.message,
    isRead: false,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  db.adminNotifications.unshift(record);
  if (db.adminNotifications.length > 200) {
    db.adminNotifications = db.adminNotifications.slice(0, 200);
  }
  return record;
}

function normalizeCustomerEmail(email?: string): string {
  return String(email || '').trim().toLowerCase();
}

function normalizeCustomerPhone10(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  if (digits.length >= 6) return digits;
  return '';
}

function isPlaceholderCustomerName(name?: string, email?: string): boolean {
  const trimmed = String(name || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'customer') return true;
  const emailPrefix = email ? email.split('@')[0]?.toLowerCase() : '';
  return Boolean(emailPrefix && trimmed.toLowerCase() === emailPrefix);
}

function mergeDuplicateUsersInDb(
  db: DatabaseSchema,
  cleanEmail: string,
  cleanPhone10: string
): UserRecord | undefined {
  const matches = db.users.filter((u) => {
    const uEmail = normalizeCustomerEmail(u.email);
    const uPhone10 = normalizeCustomerPhone10(u.phone);
    return (
      (cleanEmail && uEmail && uEmail === cleanEmail) ||
      (cleanPhone10 && uPhone10 && uPhone10 === cleanPhone10)
    );
  });

  if (matches.length === 0) return undefined;
  const primary = matches[0];

  if (matches.length > 1) {
    const duplicateIds = new Set(matches.slice(1).map((m) => m.id));
    for (const dup of matches.slice(1)) {
      if (isPlaceholderCustomerName(primary.name, primary.email) && !isPlaceholderCustomerName(dup.name, dup.email)) {
        primary.name = dup.name;
      }
      if (!primary.email && dup.email) primary.email = normalizeCustomerEmail(dup.email);
      if ((!primary.phone || primary.phone === 'N/A') && dup.phone && dup.phone !== 'N/A') {
        primary.phone = dup.phone;
      }
      if ((!primary.defaultAddress || primary.defaultAddress === 'N/A') && dup.defaultAddress && dup.defaultAddress !== 'N/A') {
        primary.defaultAddress = dup.defaultAddress;
      }
      if ((!primary.defaultPincode || primary.defaultPincode === 'N/A') && dup.defaultPincode && dup.defaultPincode !== 'N/A') {
        primary.defaultPincode = dup.defaultPincode;
      }
      if (dup.createdAt && (!primary.createdAt || new Date(dup.createdAt).getTime() < new Date(primary.createdAt).getTime())) {
        primary.createdAt = dup.createdAt;
      }
      if (dup.lastOrderAt && (!primary.lastOrderAt || new Date(dup.lastOrderAt).getTime() > new Date(primary.lastOrderAt).getTime())) {
        primary.lastOrderAt = dup.lastOrderAt;
      }
    }
    for (const ord of db.orders) {
      if (duplicateIds.has(ord.userId)) {
        ord.userId = primary.id;
      }
    }
    db.users = db.users.filter((u) => !duplicateIds.has(u.id));
  }

  return primary;
}

export async function upsertCustomerInDb(params: {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  pincode?: string;
}): Promise<UserRecord | null> {
  const cleanEmail = normalizeCustomerEmail(params.email);
  const cleanPhoneRaw = String(params.phone || '').trim();
  const cleanPhone10 = normalizeCustomerPhone10(cleanPhoneRaw);
  if (!cleanEmail && !cleanPhone10) return null;

  return withTransaction((db) => {
    const now = new Date().toISOString();
    let user = mergeDuplicateUsersInDb(db, cleanEmail, cleanPhone10);
    const incomingName = (params.name || '').trim();
    const incomingAddress = (params.address || '').trim();
    const incomingPincode = (params.pincode || '').trim();

    if (!user) {
      user = {
        id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        name: incomingName || cleanEmail.split('@')[0] || 'Customer',
        email: cleanEmail,
        phone: cleanPhone10 || (cleanPhoneRaw && cleanPhoneRaw !== 'N/A' ? cleanPhoneRaw : 'N/A'),
        defaultAddress: incomingAddress && incomingAddress !== 'N/A' ? incomingAddress : undefined,
        defaultPincode: incomingPincode && incomingPincode !== 'N/A' ? incomingPincode : undefined,
        createdAt: now,
      };
      db.users.unshift(user);
    } else {
      if (incomingName && (isPlaceholderCustomerName(user.name, user.email) || !user.name)) {
        user.name = incomingName;
      }
      if (cleanEmail && !user.email) user.email = cleanEmail;
      if (cleanPhone10 && (!user.phone || user.phone === 'N/A')) {
        user.phone = cleanPhone10;
      }
      if (incomingAddress && incomingAddress !== 'N/A') {
        user.defaultAddress = incomingAddress;
      }
      if (incomingPincode && incomingPincode !== 'N/A') {
        user.defaultPincode = incomingPincode;
      }
    }
    return user;
  });
}

// ---------- Order Operations ----------

export interface PlaceOrderInput {
  orderId?: string;
  date?: string;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    selectedColor?: string;
    selectedSize?: number;
    imagePath?: string;
    brand?: string;
    category?: string;
  }>;
  totalAmount: number;
  shippingFee?: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionId?: string;
  utrNumber?: string;
  paidToUPI?: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    pincode: string;
    email?: string;
  };
  estimatedDelivery?: string;
  carrier?: string;
  trackingNumber?: string;
}

export interface FullOrderView {
  order: OrderRecord;
  items: OrderItemRecord[];
  statusHistory: OrderStatusHistoryRecord[];
  payment: PaymentRecord | null;
  shipping: ShippingRecord | null;
  returns: ReturnRecord[];
  refunds: RefundRecord[];
  adminNotes: AdminNoteRecord[];
  notifications: NotificationRecord[];
}

function assembleFullOrder(db: DatabaseSchema, order: OrderRecord): FullOrderView {
  return {
    order,
    items: db.orderItems.filter((i) => i.orderId === order.id),
    statusHistory: db.orderStatusHistory
      .filter((h) => h.orderId === order.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    payment: db.payments.find((p) => p.orderId === order.id) || null,
    shipping: db.shipping.find((s) => s.orderId === order.id) || null,
    returns: db.returns.filter((r) => r.orderId === order.id),
    refunds: db.refunds.filter((r) => r.orderId === order.id),
    adminNotes: db.adminNotes
      .filter((n) => n.orderId === order.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    notifications: db.notifications
      .filter((n) => n.orderId === order.id)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
  };
}

export async function placeOrderTransactional(
  input: PlaceOrderInput
): Promise<{ orderView: FullOrderView; duplicate: boolean }> {
  return withTransaction((db) => {
    const now = input.date || new Date().toISOString();
    const existingNumbers = new Set(db.orders.map((o) => normalizeOrderNumber(o.orderNumber)));

    // Prevent duplicate order processing by orderNumber or transactionId
    if (input.orderId) {
      const normReq = normalizeOrderNumber(input.orderId);
      const existingByNum = db.orders.find(
        (o) => normalizeOrderNumber(o.orderNumber) === normReq
      );
      if (existingByNum) {
        return { orderView: assembleFullOrder(db, existingByNum), duplicate: true };
      }
    }

    if (input.transactionId) {
      const existingPay = db.payments.find((p) => p.transactionId === input.transactionId);
      if (existingPay) {
        const existingOrd = db.orders.find((o) => o.id === existingPay.orderId);
        if (existingOrd) {
          return { orderView: assembleFullOrder(db, existingOrd), duplicate: true };
        }
      }
    }

    // Validate live catalog inventory & compute server-authoritative totals before persisting order
    const FREE_SHIPPING_THRESHOLD = 2999;
    const STANDARD_SHIPPING_FEE = 199;

    const requestedByProduct = new Map<number, number>();
    const requestedByVariant = new Map<string, { prodId: number; size: number; color?: string; qty: number }>();
    let authoritativeSubtotal = 0;
    let authoritativeDiscount = 0;

    for (const item of input.items) {
      const prodId = Number(item.id);
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const prod = db.products.find((p) => p.id === prodId && !p.isDeleted);
      if (!prod) {
        throw new Error(`INSUFFICIENT_STOCK: Product #${prodId} is no longer available in the catalog.`);
      }
      requestedByProduct.set(prodId, (requestedByProduct.get(prodId) || 0) + qty);

      if (item.selectedSize !== undefined && !isNaN(Number(item.selectedSize))) {
        const sizeNum = Number(item.selectedSize);
        const colorKey = item.selectedColor ? item.selectedColor.trim().toLowerCase() : '';
        const vKey = `${prodId}::${sizeNum}::${colorKey}`;
        const prev = requestedByVariant.get(vKey);
        requestedByVariant.set(vKey, {
          prodId,
          size: sizeNum,
          color: item.selectedColor?.trim(),
          qty: (prev?.qty || 0) + qty,
        });
      }

      const unitPrice = Math.max(0, Number(prod.price) || 0);
      const unitMrp = Math.max(unitPrice, Number(prod.mrp) || unitPrice);
      authoritativeSubtotal += unitPrice * qty;
      authoritativeDiscount += Math.max(0, unitMrp - unitPrice) * qty;
    }

    for (const [prodId, reqQty] of requestedByProduct.entries()) {
      const prod = db.products.find((p) => p.id === prodId && !p.isDeleted);
      if (!prod) {
        throw new Error(`INSUFFICIENT_STOCK: Product #${prodId} is no longer available.`);
      }
      if (prod.status === 'inactive' || !prod.inStock || prod.stockQuantity <= 0) {
        throw new Error(`INSUFFICIENT_STOCK: "${prod.name}" is currently out of stock.`);
      }
      if (prod.stockQuantity < reqQty) {
        throw new Error(
          `INSUFFICIENT_STOCK: Only ${prod.stockQuantity} pair(s) of "${prod.name}" left in stock.`
        );
      }
    }

    for (const reqVar of requestedByVariant.values()) {
      const prod = db.products.find((p) => p.id === reqVar.prodId && !p.isDeleted);
      if (!prod) continue;
      const sizeVariants = db.productVariants.filter(
        (v) => v.productId === reqVar.prodId && v.size === reqVar.size
      );
      if (sizeVariants.length > 0) {
        const exactColorVar = reqVar.color
          ? sizeVariants.find((v) => v.color.toLowerCase() === reqVar.color!.toLowerCase())
          : undefined;
        const availableForSize = exactColorVar
          ? exactColorVar.stockQuantity
          : sizeVariants.reduce((sum, v) => sum + Math.max(0, v.stockQuantity), 0);
        if (availableForSize < reqVar.qty) {
          throw new Error(
            `INSUFFICIENT_STOCK: Only ${availableForSize} pair(s) of "${prod.name}" (UK ${reqVar.size}) left in stock.`
          );
        }
      }
    }

    const orderNumber = input.orderId
      ? normalizeOrderNumber(input.orderId)
      : generateUniqueOrderNumber(existingNumbers);
    const orderId = `ord-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const cleanEmail = normalizeCustomerEmail(input.customer.email);
    const cleanPhoneRaw = (input.customer.phone || 'N/A').trim();
    const cleanPhone10 = normalizeCustomerPhone10(cleanPhoneRaw);
    const cleanPhone = cleanPhone10 || cleanPhoneRaw || 'N/A';
    const cleanName = (input.customer.name || '').trim() || 'Customer';
    const cleanAddress = (input.customer.address || '').trim();
    const cleanPincode = (input.customer.pincode || '').trim();

    let user = mergeDuplicateUsersInDb(db, cleanEmail, cleanPhone10);
    if (!user) {
      user = {
        id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        defaultAddress: cleanAddress && cleanAddress !== 'N/A' ? cleanAddress : undefined,
        defaultPincode: cleanPincode && cleanPincode !== 'N/A' ? cleanPincode : undefined,
        createdAt: now,
        lastOrderAt: now,
      };
      db.users.push(user);
    } else {
      if (cleanName && cleanName !== 'Customer' && (isPlaceholderCustomerName(user.name, user.email) || !user.name)) {
        user.name = cleanName;
      }
      if (cleanEmail && !user.email) {
        user.email = cleanEmail;
      }
      if (cleanPhone !== 'N/A' && (!user.phone || user.phone === 'N/A')) {
        user.phone = cleanPhone;
      }
      user.lastOrderAt = now;
      if (cleanAddress && cleanAddress !== 'N/A') {
        user.defaultAddress = cleanAddress;
      }
      if (cleanPincode && cleanPincode !== 'N/A') {
        user.defaultPincode = cleanPincode;
      }
    }

    const payStatus = mapPaymentStatusFromOrder(input.paymentStatus);
    const initialStatus: OrderStatus =
      payStatus === 'Failed'
        ? 'Payment Failed'
        : payStatus === 'Paid'
        ? 'Order Confirmed'
        : 'Order Placed';

    const subtotal = authoritativeSubtotal;
    const discountAmount = authoritativeDiscount;
    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    const totalAmount = subtotal + shippingFee;

    const newOrder: OrderRecord = {
      id: orderId,
      orderNumber,
      userId: user.id,
      customerName: input.customer.name || 'Customer',
      customerPhone: cleanPhone,
      customerEmail: cleanEmail,
      deliveryAddress: input.customer.address || 'N/A',
      pincode: input.customer.pincode || 'N/A',
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
      status: initialStatus,
      paymentStatus: payStatus,
      paymentMethod: input.paymentMethod || 'Online Payment',
      stockDeducted: false,
      estimatedDelivery: input.estimatedDelivery || 'Within 3-5 Business Days',
      createdAt: now,
      updatedAt: now,
    };

    db.orders.unshift(newOrder);

    // Create OrderItems using authoritative catalog prices
    let totalItemPairs = 0;
    let firstItemName = 'Footwear';
    input.items.forEach((item, idx) => {
      const prod = db.products.find((p) => p.id === Number(item.id));
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitPrice = prod ? Math.max(0, Number(prod.price) || 0) : Math.max(0, Number(item.price) || 0);
      const resolvedName = prod?.name || item.name || 'Footwear';
      if (idx === 0) firstItemName = resolvedName;
      totalItemPairs += qty;
      db.orderItems.push({
        id: `oi-${orderId}-${idx + 1}`,
        orderId,
        productId: Number(item.id),
        sku: prod?.sku || `STEP-${String(item.id).padStart(4, '0')}`,
        name: resolvedName,
        imagePath: prod?.imagePath || item.imagePath || '/images/Empty-cart.jpg',
        brand: prod?.brand || item.brand || 'StepStyle',
        category: prod?.category || item.category || 'Sneakers',
        selectedSize: item.selectedSize ? Number(item.selectedSize) : undefined,
        selectedColor: item.selectedColor,
        quantity: qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      });
    });

    // Reserve / deduct stock immediately for both Confirmed (UPI/Card) and Placed (COD) orders
    if (initialStatus === 'Order Confirmed' || initialStatus === 'Order Placed') {
      applyStockDeduction(db, newOrder);
    }

    // Create Payment record
    db.payments.push({
      id: `pay-${orderId}`,
      orderId,
      method: input.paymentMethod || 'Online Payment',
      status: payStatus,
      amount: totalAmount,
      transactionId: input.transactionId,
      utrNumber: input.utrNumber,
      paidToUPI: input.paidToUPI,
      paidAt: payStatus === 'Paid' ? now : undefined,
      updatedAt: now,
    });

    // Create Shipping record
    const shipRecord: ShippingRecord = {
      id: `ship-${orderId}`,
      orderId,
      carrier: input.carrier || 'BlueDart Express',
      trackingNumber:
        input.trackingNumber ||
        `BD-IN-${orderNumber.replace(/\D/g, '').slice(-8) || '84920194'}`,
      estimatedDelivery: input.estimatedDelivery || 'Within 3-5 Business Days',
      updatedAt: now,
    };
    db.shipping.push(shipRecord);

    // Permanent Status History
    db.orderStatusHistory.push({
      id: `hist-${orderId}-1`,
      orderId,
      status: 'Order Placed',
      note: `Order placed via ${input.paymentMethod}`,
      updatedByAdminName: input.customer.name || 'Customer',
      updatedByRole: 'Customer',
      timestamp: now,
    });

    if (initialStatus !== 'Order Placed') {
      db.orderStatusHistory.push({
        id: `hist-${orderId}-2`,
        orderId,
        status: initialStatus,
        previousStatus: 'Order Placed',
        note:
          initialStatus === 'Order Confirmed'
            ? 'Payment verified & inventory reserved'
            : 'Payment authorization failed',
        updatedByAdminName: 'Payment Gateway',
        updatedByRole: 'System',
        timestamp: now,
      });
    }

    createOrderNotifications(db, newOrder, shipRecord, initialStatus);

    // Record live Admin Order Notification for the Admin Orders dashboard
    pushAdminNotification(db, {
      type: 'new_order',
      orderId,
      orderNumber,
      customerName: newOrder.customerName,
      customerPhone: cleanPhone,
      totalAmount,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: payStatus,
      itemCount: totalItemPairs,
      primaryItemName: firstItemName,
      message: `New order ${orderNumber} placed by ${newOrder.customerName} (${totalItemPairs} ${
        totalItemPairs === 1 ? 'pair' : 'pairs'
      } · ₹${totalAmount.toLocaleString('en-IN')})`,
      createdAt: now,
    });

    return { orderView: assembleFullOrder(db, newOrder), duplicate: false };
  });
}

export interface ClientSyncOrderInput {
  orderId?: string;
  orderNumber?: string;
  date?: string;
  updatedAt?: string;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    selectedColor?: string;
    selectedSize?: number;
    imagePath?: string;
    brand?: string;
    category?: string;
  }>;
  totalAmount: number;
  shippingFee?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  transactionId?: string;
  utrNumber?: string;
  paidToUPI?: string;
  status?: string;
  stage?: string;
  customer: {
    name?: string;
    phone?: string;
    address?: string;
    pincode?: string;
    email?: string;
  };
  estimatedDelivery?: string;
  carrier?: string;
  trackingNumber?: string;
}

export async function reconcileClientOrdersTransactional(
  rawOrders: ClientSyncOrderInput[],
  options?: { allowStatusPreservation?: boolean }
): Promise<{
  importedCount: number;
  alreadyPresentCount: number;
  skippedPurgedCount: number;
  importedOrderNumbers: string[];
  lastPurgedAt: string | null;
}> {
  if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
    const db = await getDatabase();
    return {
      importedCount: 0,
      alreadyPresentCount: 0,
      skippedPurgedCount: 0,
      importedOrderNumbers: [],
      lastPurgedAt: db.lastPurgedAt || null,
    };
  }

  return withTransaction((db) => {
    const existingNumbers = new Set(db.orders.map((o) => normalizeOrderNumber(o.orderNumber)));
    const existingTxnIds = new Set(
      db.payments
        .map((p) => (p.transactionId || '').trim())
        .filter((t) => t.length > 0 && t.toUpperCase() !== 'N/A')
    );
    const purgeCutoffMs = db.lastPurgedAt ? new Date(db.lastPurgedAt).getTime() : 0;

    let importedCount = 0;
    let alreadyPresentCount = 0;
    let skippedPurgedCount = 0;
    const importedOrderNumbers: string[] = [];
    const fallbackNow = new Date().toISOString();

    for (const ro of rawOrders) {
      if (!ro || typeof ro !== 'object') continue;
      const rawCode = String(ro.orderNumber || ro.orderId || '').trim();
      const orderNumber = normalizeOrderNumber(rawCode);
      if (!orderNumber || orderNumber.length < 4 || orderNumber.length > 32) continue;

      const parsedDate = ro.date ? new Date(ro.date) : null;
      const parsedUpdated = ro.updatedAt ? new Date(ro.updatedAt) : null;
      const effectiveOrderMs =
        parsedDate && !isNaN(parsedDate.getTime())
          ? parsedDate.getTime()
          : parsedUpdated && !isNaN(parsedUpdated.getTime())
          ? parsedUpdated.getTime()
          : NaN;
      if (
        purgeCutoffMs > 0 &&
        (!Number.isFinite(effectiveOrderMs) || effectiveOrderMs <= purgeCutoffMs)
      ) {
        skippedPurgedCount++;
        continue;
      }

      const cleanTxn = ro.transactionId ? String(ro.transactionId).trim() : '';
      if (
        existingNumbers.has(orderNumber) ||
        (cleanTxn && cleanTxn.toUpperCase() !== 'N/A' && existingTxnIds.has(cleanTxn))
      ) {
        alreadyPresentCount++;
        continue;
      }

      const rawItems = Array.isArray(ro.items) ? ro.items : [];
      if (rawItems.length === 0) continue;

      const totalAmount = Number(ro.totalAmount);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) continue;

      const shippingFee = Number.isFinite(Number(ro.shippingFee))
        ? Math.max(0, Number(ro.shippingFee))
        : 0;
      const subtotal = Math.max(0, totalAmount - shippingFee);

      const createdAt =
        parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : fallbackNow;
      const updatedAt =
        parsedUpdated && !isNaN(parsedUpdated.getTime()) ? parsedUpdated.toISOString() : createdAt;

      const cleanEmail = normalizeCustomerEmail(ro.customer?.email);
      const cleanPhoneRaw = String(ro.customer?.phone || 'N/A').trim();
      const cleanPhone10 = normalizeCustomerPhone10(cleanPhoneRaw);
      const cleanPhone = cleanPhone10 || cleanPhoneRaw || 'N/A';
      const cleanName = String(ro.customer?.name || 'Customer').trim().slice(0, 120) || 'Customer';
      const cleanAddress = String(ro.customer?.address || 'N/A').trim().slice(0, 500) || 'N/A';
      const cleanPincode = String(ro.customer?.pincode || 'N/A').trim().slice(0, 20) || 'N/A';

      let user = mergeDuplicateUsersInDb(db, cleanEmail, cleanPhone10);
      if (!user) {
        user = {
          id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          defaultAddress: cleanAddress !== 'N/A' ? cleanAddress : undefined,
          defaultPincode: cleanPincode !== 'N/A' ? cleanPincode : undefined,
          createdAt,
          lastOrderAt: createdAt,
        };
        db.users.push(user);
      } else {
        if (cleanName !== 'Customer' && (isPlaceholderCustomerName(user.name, user.email) || !user.name)) {
          user.name = cleanName;
        }
        if (cleanEmail && !user.email) user.email = cleanEmail;
        if (cleanPhone !== 'N/A' && (!user.phone || user.phone === 'N/A')) {
          user.phone = cleanPhone;
        }
        if (!user.lastOrderAt || new Date(createdAt).getTime() > new Date(user.lastOrderAt).getTime()) {
          user.lastOrderAt = createdAt;
        }
        if (cleanAddress !== 'N/A' && (!user.defaultAddress || user.defaultAddress === 'N/A')) {
          user.defaultAddress = cleanAddress;
        }
        if (cleanPincode !== 'N/A' && (!user.defaultPincode || user.defaultPincode === 'N/A')) {
          user.defaultPincode = cleanPincode;
        }
      }

      const payStatus = mapPaymentStatusFromOrder(String(ro.paymentStatus || 'Pending'));
      const rawStatus = typeof ro.status === 'string' ? ro.status.trim() : '';
      const status: OrderStatus =
        options?.allowStatusPreservation && ALL_ORDER_STATUSES.includes(rawStatus as OrderStatus)
          ? (rawStatus as OrderStatus)
          : payStatus === 'Failed'
          ? 'Payment Failed'
          : payStatus === 'Paid'
          ? 'Order Confirmed'
          : 'Order Placed';

      const orderId = `ord-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      const newOrder: OrderRecord = {
        id: orderId,
        orderNumber,
        userId: user.id,
        customerName: cleanName,
        customerPhone: cleanPhone,
        customerEmail: cleanEmail,
        deliveryAddress: cleanAddress,
        pincode: cleanPincode,
        subtotal,
        shippingFee,
        totalAmount,
        status,
        paymentStatus: payStatus,
        paymentMethod: String(ro.paymentMethod || 'Online Payment').trim().slice(0, 80),
        stockDeducted: false,
        estimatedDelivery: String(ro.estimatedDelivery || 'Within 3-5 Business Days').slice(0, 120),
        createdAt,
        updatedAt,
      };

      db.orders.unshift(newOrder);
      existingNumbers.add(orderNumber);
      if (cleanTxn && cleanTxn.toUpperCase() !== 'N/A') {
        existingTxnIds.add(cleanTxn);
      }

      let totalPairs = 0;
      let firstItemName = 'Footwear';
      rawItems.forEach((item, idx) => {
        const prodId = Number(item?.id) || 0;
        const prod = db.products.find((p) => p.id === prodId);
        const qty = Math.max(1, Math.min(50, Math.floor(Number(item?.quantity) || 1)));
        const unitPrice = Math.max(0, Number(item?.price) || prod?.price || 0);
        const resolvedName = String(item?.name || prod?.name || 'Footwear Item').slice(0, 160);
        if (idx === 0) firstItemName = resolvedName;
        totalPairs += qty;

        db.orderItems.push({
          id: `oi-${orderId}-${idx + 1}`,
          orderId,
          productId: prodId,
          sku: prod?.sku || `STEP-${String(prodId || idx + 1).padStart(4, '0')}`,
          name: resolvedName,
          imagePath: String(item?.imagePath || prod?.imagePath || '/images/Empty-cart.jpg').slice(0, 300),
          brand: String(item?.brand || prod?.brand || 'StepStyle').slice(0, 80),
          category: String(item?.category || prod?.category || 'Sneakers').slice(0, 80),
          selectedSize: item?.selectedSize ? Number(item.selectedSize) : undefined,
          selectedColor: item?.selectedColor ? String(item.selectedColor).slice(0, 80) : undefined,
          quantity: qty,
          unitPrice,
          lineTotal: unitPrice * qty,
        });
      });

      db.payments.push({
        id: `pay-${orderId}`,
        orderId,
        method: newOrder.paymentMethod,
        status: payStatus,
        amount: totalAmount,
        transactionId: cleanTxn && cleanTxn.toUpperCase() !== 'N/A' ? cleanTxn.slice(0, 80) : undefined,
        utrNumber:
          ro.utrNumber && String(ro.utrNumber).trim().toUpperCase() !== 'N/A'
            ? String(ro.utrNumber).trim().slice(0, 80)
            : undefined,
        paidToUPI: ro.paidToUPI ? String(ro.paidToUPI).trim().slice(0, 120) : undefined,
        paidAt: payStatus === 'Paid' ? createdAt : undefined,
        updatedAt,
      });

      const shipRecord: ShippingRecord = {
        id: `ship-${orderId}`,
        orderId,
        carrier: String(ro.carrier || 'BlueDart Express').slice(0, 80),
        trackingNumber: String(
          ro.trackingNumber || `BD-IN-${orderNumber.replace(/\D/g, '').slice(-8) || '84920194'}`
        ).slice(0, 80),
        estimatedDelivery: newOrder.estimatedDelivery,
        updatedAt,
      };
      db.shipping.push(shipRecord);

      db.orderStatusHistory.push({
        id: `hist-${orderId}-1`,
        orderId,
        status: 'Order Placed',
        note: `Order synced from storefront (${newOrder.paymentMethod})`,
        updatedByAdminName: cleanName,
        updatedByRole: 'Customer',
        timestamp: createdAt,
      });

      if (status !== 'Order Placed') {
        db.orderStatusHistory.push({
          id: `hist-${orderId}-2`,
          orderId,
          status,
          previousStatus: 'Order Placed',
          note: payStatus === 'Paid' ? 'Payment verified' : `Status recorded as ${status}`,
          updatedByAdminName: 'System',
          updatedByRole: 'System',
          timestamp: updatedAt,
        });
      }

      pushAdminNotification(db, {
        type: 'new_order',
        orderId,
        orderNumber,
        customerName: cleanName,
        customerPhone: cleanPhone,
        totalAmount,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: payStatus,
        itemCount: Math.max(1, totalPairs),
        primaryItemName: firstItemName,
        message: `Order ${orderNumber} synced for ${cleanName} (${totalPairs} ${
          totalPairs === 1 ? 'pair' : 'pairs'
        } · ₹${totalAmount.toLocaleString('en-IN')})`,
        createdAt,
      });

      importedCount++;
      importedOrderNumbers.push(orderNumber);
    }

    return {
      importedCount,
      alreadyPresentCount,
      skippedPurgedCount,
      importedOrderNumbers,
      lastPurgedAt: db.lastPurgedAt || null,
    };
  });
}

export async function getFullOrderByNumber(orderNumberInput: string): Promise<FullOrderView | null> {
  const db = await getDatabase();
  const norm = normalizeOrderNumber(orderNumberInput);
  if (!norm) return null;
  const order = db.orders.find((o) => normalizeOrderNumber(o.orderNumber) === norm);
  if (!order) return null;
  return assembleFullOrder(db, order);
}

export async function getOrdersForCustomer(email?: string, phone?: string): Promise<FullOrderView[]> {
  const db = await getDatabase();
  const normEmail = email?.trim().toLowerCase();
  const normPhone = phone?.replace(/\D/g, '');
  if (!normEmail && !normPhone) return [];

  return db.orders
    .filter((o) => {
      if (normEmail && o.customerEmail && o.customerEmail.toLowerCase() === normEmail) return true;
      if (
        normPhone &&
        normPhone.length >= 10 &&
        o.customerPhone &&
        o.customerPhone.replace(/\D/g, '').endsWith(normPhone.slice(-10))
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => assembleFullOrder(db, o));
}

export async function getAllOrdersAdmin(filters?: {
  search?: string;
  status?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'newest' | 'oldest' | 'amountDesc' | 'amountAsc';
}): Promise<{
  orders: FullOrderView[];
  overview: {
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    processingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    returnedOrRefundedOrders: number;
    totalRevenue: number;
  };
}> {
  const db = await getDatabase(true);

  const overview = {
    totalOrders: db.orders.length,
    pendingOrders: db.orders.filter((o) =>
      ['Order Placed', 'Order Accepted', 'Payment Failed'].includes(o.status)
    ).length,
    confirmedOrders: db.orders.filter((o) => o.status === 'Order Confirmed').length,
    processingOrders: db.orders.filter((o) =>
      ['Processing', 'Packed'].includes(o.status)
    ).length,
    shippedOrders: db.orders.filter((o) =>
      ['Shipped', 'Out for Delivery'].includes(o.status)
    ).length,
    deliveredOrders: db.orders.filter((o) => o.status === 'Delivered').length,
    cancelledOrders: db.orders.filter((o) => o.status === 'Order Cancelled').length,
    returnedOrRefundedOrders: db.orders.filter((o) =>
      ['Return Requested', 'Returned', 'Refund Initiated', 'Refunded'].includes(o.status)
    ).length,
    totalRevenue: db.orders
      .filter((o) => !['Order Cancelled', 'Payment Failed', 'Refunded'].includes(o.status))
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
  };

  let filtered = [...db.orders];

  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q)
    );
  }

  if (filters?.status && filters.status !== 'All') {
    filtered = filtered.filter((o) => o.status === filters.status);
  }

  if (filters?.paymentStatus && filters.paymentStatus !== 'All') {
    filtered = filtered.filter((o) => o.paymentStatus === filters.paymentStatus);
  }

  if (filters?.dateFrom) {
    const fromTime = new Date(filters.dateFrom).getTime();
    if (!isNaN(fromTime)) {
      filtered = filtered.filter((o) => new Date(o.createdAt).getTime() >= fromTime);
    }
  }

  if (filters?.dateTo) {
    const toTime = new Date(filters.dateTo).getTime() + 86400000;
    if (!isNaN(toTime)) {
      filtered = filtered.filter((o) => new Date(o.createdAt).getTime() <= toTime);
    }
  }

  const sortMode = filters?.sort || 'newest';
  filtered.sort((a, b) => {
    if (sortMode === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortMode === 'amountDesc') {
      return b.totalAmount - a.totalAmount;
    }
    if (sortMode === 'amountAsc') {
      return a.totalAmount - b.totalAmount;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    orders: filtered.map((o) => assembleFullOrder(db, o)),
    overview,
  };
}

export async function updateOrderStatusTransactional(params: {
  orderNumber: string;
  status: OrderStatus;
  adminId: string;
  adminName: string;
  adminRole: string;
  note?: string;
  cancelReason?: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}): Promise<FullOrderView | null> {
  return withTransaction((db) => {
    const norm = normalizeOrderNumber(params.orderNumber);
    const ordIdx = db.orders.findIndex((o) => normalizeOrderNumber(o.orderNumber) === norm);
    if (ordIdx === -1) return null;

    const order = db.orders[ordIdx];
    const previousStatus = order.status;
    const now = new Date().toISOString();

    order.status = params.status;
    order.updatedAt = now;
    if (params.cancelReason) {
      order.cancelReason = params.cancelReason.trim();
    }

    // Inventory policy: deduct stock on confirmation, restore on cancel/return
    if (
      [
        'Order Confirmed',
        'Processing',
        'Packed',
        'Shipped',
        'Out for Delivery',
        'Delivered',
      ].includes(params.status) &&
      !order.stockDeducted
    ) {
      applyStockDeduction(db, order);
    } else if (
      ['Order Cancelled', 'Payment Failed', 'Returned'].includes(params.status) &&
      order.stockDeducted
    ) {
      applyStockRestoration(db, order);
    }

    // Update payment status if payment failed / refunded
    const payIdx = db.payments.findIndex((p) => p.orderId === order.id);
    if (params.status === 'Payment Failed') {
      order.paymentStatus = 'Failed';
      if (payIdx >= 0) db.payments[payIdx].status = 'Failed';
    } else if (params.status === 'Refund Initiated') {
      order.paymentStatus = 'Refund Initiated';
      if (payIdx >= 0) db.payments[payIdx].status = 'Refund Initiated';
    } else if (params.status === 'Refunded') {
      order.paymentStatus = 'Refunded';
      if (payIdx >= 0) db.payments[payIdx].status = 'Refunded';
    } else if (
      ['Order Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'].includes(
        params.status
      ) &&
      order.paymentStatus === 'Pending' &&
      !order.paymentMethod.toLowerCase().includes('cash')
    ) {
      order.paymentStatus = 'Paid';
      if (payIdx >= 0) {
        db.payments[payIdx].status = 'Paid';
        db.payments[payIdx].paidAt = db.payments[payIdx].paidAt || now;
      }
    }
    if (payIdx >= 0) db.payments[payIdx].updatedAt = now;

    // Update Shipping
    let shipIdx = db.shipping.findIndex((s) => s.orderId === order.id);
    if (shipIdx === -1) {
      db.shipping.push({
        id: `ship-${order.id}`,
        orderId: order.id,
        carrier: params.carrier || 'BlueDart Express',
        trackingNumber:
          params.trackingNumber || `BD-IN-${order.orderNumber.replace(/\D/g, '').slice(-8)}`,
        estimatedDelivery: params.estimatedDelivery || order.estimatedDelivery,
        updatedAt: now,
      });
      shipIdx = db.shipping.length - 1;
    }

    const ship = db.shipping[shipIdx];
    if (params.carrier) ship.carrier = params.carrier.trim();
    if (params.trackingNumber) ship.trackingNumber = params.trackingNumber.trim();
    if (params.estimatedDelivery) {
      ship.estimatedDelivery = params.estimatedDelivery.trim();
      order.estimatedDelivery = params.estimatedDelivery.trim();
    }
    if (params.status === 'Shipped' && !ship.shippedAt) ship.shippedAt = now;
    if (params.status === 'Delivered' && !ship.deliveredAt) {
      ship.deliveredAt = now;
      if (order.paymentMethod.toLowerCase().includes('cash')) {
        order.paymentStatus = 'Paid';
        if (payIdx >= 0) {
          db.payments[payIdx].status = 'Paid';
          db.payments[payIdx].paidAt = now;
        }
      }
    }
    ship.updatedAt = now;

    // Handle Return / Refund records
    if (params.status === 'Return Requested' || params.status === 'Returned') {
      const retIdx = db.returns.findIndex((r) => r.orderId === order.id);
      if (retIdx === -1) {
        db.returns.push({
          id: `ret-${Date.now()}`,
          orderId: order.id,
          reason: params.note || params.cancelReason || 'Customer requested return',
          status: params.status === 'Returned' ? 'Returned' : 'Requested',
          requestedAt: now,
          resolvedAt: params.status === 'Returned' ? now : undefined,
          handledByAdminName: params.adminName,
        });
      } else {
        db.returns[retIdx].status = params.status === 'Returned' ? 'Returned' : 'Approved';
        if (params.status === 'Returned') db.returns[retIdx].resolvedAt = now;
        db.returns[retIdx].handledByAdminName = params.adminName;
      }
    }

    if (params.status === 'Refund Initiated' || params.status === 'Refunded') {
      const refIdx = db.refunds.findIndex((r) => r.orderId === order.id);
      if (refIdx === -1) {
        db.refunds.push({
          id: `ref-${Date.now()}`,
          orderId: order.id,
          amount: order.totalAmount,
          method: order.paymentMethod,
          status: params.status === 'Refunded' ? 'Refunded' : 'Initiated',
          referenceId: `RFD-${order.orderNumber.replace(/[^A-Z0-9]/g, '').slice(-8)}-${Math.floor(
            100 + Math.random() * 899
          )}`,
          initiatedAt: now,
          completedAt: params.status === 'Refunded' ? now : undefined,
          handledByAdminName: params.adminName,
        });
      } else {
        db.refunds[refIdx].status = params.status === 'Refunded' ? 'Refunded' : 'Processing';
        if (params.status === 'Refunded') db.refunds[refIdx].completedAt = now;
        db.refunds[refIdx].handledByAdminName = params.adminName;
      }
    }

    // Permanent Order Status History
    const historyNote =
      params.note ||
      (params.cancelReason ? `Cancelled: ${params.cancelReason}` : undefined) ||
      `Status updated to ${params.status}`;

    db.orderStatusHistory.push({
      id: `hist-${order.id}-${Date.now()}`,
      orderId: order.id,
      status: params.status,
      previousStatus,
      note: historyNote,
      updatedByAdminId: params.adminId,
      updatedByAdminName: params.adminName,
      updatedByRole: params.adminRole,
      timestamp: now,
    });

    createOrderNotifications(db, order, ship, params.status, historyNote);

    if (params.status === 'Return Requested') {
      const items = db.orderItems.filter((i) => i.orderId === order.id);
      const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
      pushAdminNotification(db, {
        type: 'return_requested',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        itemCount,
        primaryItemName: items[0]?.name || 'Footwear',
        message: `Return requested for ${order.orderNumber} by ${order.customerName}`,
        createdAt: now,
      });
    }

    return assembleFullOrder(db, order);
  });
}

export async function getAdminNotificationsFromDb(limit = 50): Promise<{
  notifications: AdminNotificationRecord[];
  unreadCount: number;
}> {
  const db = await getDatabase(true);
  const list = Array.isArray(db.adminNotifications) ? db.adminNotifications : [];
  const sorted = [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return {
    notifications: sorted.slice(0, limit),
    unreadCount: sorted.filter((n) => !n.isRead).length,
  };
}

export async function markAdminNotificationsReadInDb(params: {
  id?: string;
  orderNumber?: string;
  all?: boolean;
  adminName?: string;
}): Promise<{
  notifications: AdminNotificationRecord[];
  unreadCount: number;
}> {
  return withTransaction((db) => {
    if (!Array.isArray(db.adminNotifications)) {
      db.adminNotifications = [];
    }
    const now = new Date().toISOString();
    const targetOrderNum = params.orderNumber
      ? normalizeOrderNumber(params.orderNumber)
      : undefined;

    for (const n of db.adminNotifications) {
      if (n.isRead) continue;
      const matches =
        Boolean(params.all) ||
        (params.id && n.id === params.id) ||
        (targetOrderNum && normalizeOrderNumber(n.orderNumber) === targetOrderNum);
      if (matches) {
        n.isRead = true;
        n.readAt = now;
        n.readByAdminName = params.adminName || 'Admin';
      }
    }

    const sorted = [...db.adminNotifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      notifications: sorted.slice(0, 50),
      unreadCount: sorted.filter((n) => !n.isRead).length,
    };
  });
}

export async function addAdminNoteTransactional(params: {
  orderNumber: string;
  adminId: string;
  adminName: string;
  note: string;
}): Promise<AdminNoteRecord | null> {
  return withTransaction((db) => {
    const norm = normalizeOrderNumber(params.orderNumber);
    const order = db.orders.find((o) => normalizeOrderNumber(o.orderNumber) === norm);
    if (!order) return null;

    const record: AdminNoteRecord = {
      id: `note-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      orderId: order.id,
      adminId: params.adminId,
      adminName: params.adminName,
      note: params.note.trim(),
      createdAt: new Date().toISOString(),
    };

    db.adminNotes.unshift(record);
    return record;
  });
}

export interface AdminCustomerOrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: OrderRecord['paymentStatus'];
  paymentMethod: string;
  itemCount: number;
  primaryItemName: string;
  deliveryAddress: string;
  pincode: string;
}

export interface AdminCustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  defaultAddress?: string;
  defaultPincode?: string;
  createdAt: string;
  lastOrderAt?: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderNumber?: string;
  orders: AdminCustomerOrderSummary[];
}

function buildUnifiedCustomerProfiles(db: DatabaseSchema): AdminCustomerProfile[] {
  const profileBuckets: Array<{
    profile: UserRecord;
    emails: Set<string>;
    phones: Set<string>;
    userIds: Set<string>;
    orders: OrderRecord[];
  }> = [];

  const findBucket = (userId?: string, email?: string, phone?: string) => {
    const cleanEmail = normalizeCustomerEmail(email);
    const cleanPhone10 = normalizeCustomerPhone10(phone);
    return profileBuckets.find(
      (b) =>
        (userId && b.userIds.has(userId)) ||
        (cleanEmail && b.emails.has(cleanEmail)) ||
        (cleanPhone10 && b.phones.has(cleanPhone10))
    );
  };

  for (const u of db.users) {
    const cleanEmail = normalizeCustomerEmail(u.email);
    const cleanPhone10 = normalizeCustomerPhone10(u.phone);
    const existing = findBucket(u.id, cleanEmail, cleanPhone10);

    if (existing) {
      existing.userIds.add(u.id);
      if (cleanEmail) existing.emails.add(cleanEmail);
      if (cleanPhone10) existing.phones.add(cleanPhone10);
      if (isPlaceholderCustomerName(existing.profile.name, existing.profile.email) && !isPlaceholderCustomerName(u.name, u.email)) {
        existing.profile.name = u.name;
      }
      if (!existing.profile.email && cleanEmail) existing.profile.email = cleanEmail;
      if ((!existing.profile.phone || existing.profile.phone === 'N/A') && u.phone && u.phone !== 'N/A') {
        existing.profile.phone = cleanPhone10 || u.phone;
      }
      if ((!existing.profile.defaultAddress || existing.profile.defaultAddress === 'N/A') && u.defaultAddress && u.defaultAddress !== 'N/A') {
        existing.profile.defaultAddress = u.defaultAddress;
      }
      if ((!existing.profile.defaultPincode || existing.profile.defaultPincode === 'N/A') && u.defaultPincode && u.defaultPincode !== 'N/A') {
        existing.profile.defaultPincode = u.defaultPincode;
      }
      if (u.createdAt && new Date(u.createdAt).getTime() < new Date(existing.profile.createdAt).getTime()) {
        existing.profile.createdAt = u.createdAt;
      }
      if (
        u.lastOrderAt &&
        (!existing.profile.lastOrderAt ||
          new Date(u.lastOrderAt).getTime() > new Date(existing.profile.lastOrderAt).getTime())
      ) {
        existing.profile.lastOrderAt = u.lastOrderAt;
      }
    } else {
      const emails = new Set<string>();
      const phones = new Set<string>();
      if (cleanEmail) emails.add(cleanEmail);
      if (cleanPhone10) phones.add(cleanPhone10);
      profileBuckets.push({
        profile: {
          ...u,
          email: cleanEmail || u.email || '',
          phone: cleanPhone10 || u.phone || 'N/A',
        },
        emails,
        phones,
        userIds: new Set([u.id]),
        orders: [],
      });
    }
  }

  for (const ord of db.orders) {
    const cleanEmail = normalizeCustomerEmail(ord.customerEmail);
    const cleanPhone10 = normalizeCustomerPhone10(ord.customerPhone);
    let bucket = findBucket(ord.userId, cleanEmail, cleanPhone10);

    if (!bucket) {
      const emails = new Set<string>();
      const phones = new Set<string>();
      if (cleanEmail) emails.add(cleanEmail);
      if (cleanPhone10) phones.add(cleanPhone10);
      bucket = {
        profile: {
          id: ord.userId || `usr-${ord.id}`,
          name: ord.customerName || 'Customer',
          email: cleanEmail,
          phone: cleanPhone10 || ord.customerPhone || 'N/A',
          defaultAddress: ord.deliveryAddress !== 'N/A' ? ord.deliveryAddress : undefined,
          defaultPincode: ord.pincode !== 'N/A' ? ord.pincode : undefined,
          createdAt: ord.createdAt,
          lastOrderAt: ord.createdAt,
        },
        emails,
        phones,
        userIds: new Set(ord.userId ? [ord.userId] : []),
        orders: [],
      };
      profileBuckets.push(bucket);
    } else {
      if (ord.userId) bucket.userIds.add(ord.userId);
      if (cleanEmail) bucket.emails.add(cleanEmail);
      if (cleanPhone10) bucket.phones.add(cleanPhone10);
    }

    bucket.orders.push(ord);
  }

  const profiles: AdminCustomerProfile[] = profileBuckets.map((bucket) => {
    const sortedOrders = [...bucket.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    let name = bucket.profile.name;
    let email = bucket.profile.email;
    let phone = bucket.profile.phone;
    let defaultAddress = bucket.profile.defaultAddress;
    let defaultPincode = bucket.profile.defaultPincode;

    for (const ord of sortedOrders) {
      if (isPlaceholderCustomerName(name, email) && ord.customerName && ord.customerName !== 'Customer') {
        name = ord.customerName;
      }
      if (!email && ord.customerEmail) {
        email = normalizeCustomerEmail(ord.customerEmail);
      }
      if ((!phone || phone === 'N/A') && ord.customerPhone && ord.customerPhone !== 'N/A') {
        phone = normalizeCustomerPhone10(ord.customerPhone) || ord.customerPhone;
      }
      if ((!defaultAddress || defaultAddress === 'N/A') && ord.deliveryAddress && ord.deliveryAddress !== 'N/A') {
        defaultAddress = ord.deliveryAddress;
      }
      if ((!defaultPincode || defaultPincode === 'N/A') && ord.pincode && ord.pincode !== 'N/A') {
        defaultPincode = ord.pincode;
      }
    }

    const totalSpent = sortedOrders
      .filter((o) => !['Order Cancelled', 'Payment Failed', 'Refunded'].includes(o.status))
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const lastOrderAt = sortedOrders[0]?.createdAt || bucket.profile.lastOrderAt;

    const orderSummaries: AdminCustomerOrderSummary[] = sortedOrders.map((ord) => {
      const items = db.orderItems.filter((i) => i.orderId === ord.id);
      const itemCount = items.reduce((s, i) => s + (i.quantity || 1), 0);
      return {
        id: ord.id,
        orderNumber: ord.orderNumber,
        createdAt: ord.createdAt,
        totalAmount: ord.totalAmount,
        status: ord.status,
        paymentStatus: ord.paymentStatus,
        paymentMethod: ord.paymentMethod,
        itemCount,
        primaryItemName: items[0]?.name || 'Footwear',
        deliveryAddress: ord.deliveryAddress,
        pincode: ord.pincode,
      };
    });

    return {
      id: bucket.profile.id,
      name: name || 'Customer',
      email: email || '',
      phone: phone || 'N/A',
      defaultAddress,
      defaultPincode,
      createdAt: bucket.profile.createdAt,
      lastOrderAt,
      ordersCount: sortedOrders.length,
      totalSpent,
      lastOrderNumber: sortedOrders[0]?.orderNumber,
      orders: orderSummaries,
    };
  });

  return profiles.sort((a, b) => {
    const aTime = new Date(a.lastOrderAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.lastOrderAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export async function getAdminCustomersFromDb(): Promise<AdminCustomerProfile[]> {
  const db = await getDatabase(true);
  return buildUnifiedCustomerProfiles(db);
}

function buildAdminAnalyticsAndEntitiesFromSchema(db: DatabaseSchema) {
  const customers = buildUnifiedCustomerProfiles(db);

  const activeProducts = db.products.filter((p) => !p.isDeleted);
  const categories = db.categories.map((c) => {
    const items = activeProducts.filter((p) => p.category === c.name);
    return {
      ...c,
      productCount: items.length,
      totalStock: items.reduce((s, p) => s + (p.stockQuantity || 0), 0),
    };
  });

  const brands = db.brands.map((b) => {
    const items = activeProducts.filter((p) => p.brand === b.name);
    return {
      ...b,
      productCount: items.length,
    };
  });

  return {
    categories,
    brands,
    customers,
    payments: db.payments.map((p) => {
      const ord = db.orders.find((o) => o.id === p.orderId);
      return { ...p, orderNumber: ord?.orderNumber, customerName: ord?.customerName };
    }),
    shipping: db.shipping.map((s) => {
      const ord = db.orders.find((o) => o.id === s.orderId);
      return {
        ...s,
        orderNumber: ord?.orderNumber,
        orderStatus: ord?.status,
        customerName: ord?.customerName,
        pincode: ord?.pincode,
      };
    }),
    returns: db.returns.map((r) => {
      const ord = db.orders.find((o) => o.id === r.orderId);
      return { ...r, orderNumber: ord?.orderNumber, customerName: ord?.customerName };
    }),
    refunds: db.refunds.map((r) => {
      const ord = db.orders.find((o) => o.id === r.orderId);
      return { ...r, orderNumber: ord?.orderNumber, customerName: ord?.customerName };
    }),
    notifications: db.notifications.slice(0, 100),
  };
}

export async function getAdminAnalyticsAndEntities() {
  const db = await getDatabase(true);
  return buildAdminAnalyticsAndEntitiesFromSchema(db);
}

export async function getAdminOverviewSnapshotFromDb() {
  const db = await getDatabase(true);

  const overview = {
    totalOrders: db.orders.length,
    pendingOrders: db.orders.filter((o) =>
      ['Order Placed', 'Order Accepted', 'Payment Failed'].includes(o.status)
    ).length,
    confirmedOrders: db.orders.filter((o) => o.status === 'Order Confirmed').length,
    processingOrders: db.orders.filter((o) =>
      ['Processing', 'Packed'].includes(o.status)
    ).length,
    shippedOrders: db.orders.filter((o) =>
      ['Shipped', 'Out for Delivery'].includes(o.status)
    ).length,
    deliveredOrders: db.orders.filter((o) => o.status === 'Delivered').length,
    cancelledOrders: db.orders.filter((o) => o.status === 'Order Cancelled').length,
    returnedOrRefundedOrders: db.orders.filter((o) =>
      ['Return Requested', 'Returned', 'Refund Initiated', 'Refunded'].includes(o.status)
    ).length,
    totalRevenue: db.orders
      .filter((o) => !['Order Cancelled', 'Payment Failed', 'Refunded'].includes(o.status))
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0),
  };

  const sortedOrders = [...db.orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => assembleFullOrder(db, o));

  const products = db.products.filter((p) => !p.isDeleted);
  const entities = buildAdminAnalyticsAndEntitiesFromSchema(db);

  const notifList = Array.isArray(db.adminNotifications) ? db.adminNotifications : [];
  const sortedNotifications = [...notifList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const admins = db.adminUsers.map(({ passwordHash: _h, passwordSalt: _s, ...safe }) => safe);
  const supportList = Array.isArray(db.supportMessages) ? db.supportMessages : [];
  const storageMode: 'mongodb' | 'local-json' | 'local-memory-fallback' = isMongoConfigured()
    ? 'mongodb'
    : globalForDb.__stepstyleMemoryFallbackActive
    ? 'local-memory-fallback'
    : 'local-json';

  return {
    overview,
    orders: sortedOrders,
    recentOrders: sortedOrders.slice(0, 8),
    productsCount: products.length,
    lowStockProducts: products.filter((p) => (p.stockQuantity ?? 0) <= 10),
    ...entities,
    adminNotifications: sortedNotifications.slice(0, 50),
    unreadNotificationsCount: sortedNotifications.filter((n) => !n.isRead).length,
    openSupportCount: supportList.filter((m) => m.status !== 'resolved').length,
    supportMessagesCount: supportList.length,
    admins,
    storageMode,
    lastPurgedAt: db.lastPurgedAt || null,
    syncedAt: new Date().toISOString(),
  };
}

export async function getLastPurgedAtFromDb(): Promise<string | null> {
  const db = await getDatabase();
  return db.lastPurgedAt || null;
}

export async function verifySuperAdminPasswordAndPurgeOldDataInDb(params: {
  adminId: string;
  password: string;
}): Promise<
  | {
      success: true;
      purged: {
        orders: number;
        orderItems: number;
        customers: number;
        payments: number;
        shipping: number;
        returns: number;
        refunds: number;
        tickets: number;
        notifications: number;
      };
      lastPurgedAt: string;
      storageMode: 'mongodb' | 'local-json' | 'local-memory-fallback';
    }
  | { success: false; error: string; status: number }
> {
  const cleanPassword = params.password;
  if (!cleanPassword || !cleanPassword.trim()) {
    return {
      success: false as const,
      error: 'Super Admin password is required to delete old data.',
      status: 400,
    };
  }

  const checkPasswordForAdmin = (adminUser: AdminUserRecord | undefined) => {
    if (!adminUser || adminUser.status !== 'active') {
      return {
        ok: false as const,
        status: 403,
        error: 'Super Admin account is inactive or unavailable.',
      };
    }
    if (adminUser.role !== 'Super Admin') {
      return {
        ok: false as const,
        status: 403,
        error: 'Only a Super Admin can delete old transactional data.',
      };
    }
    const envOverride =
      adminUser.id === 'admin-soyab-super' && process.env.SUPER_ADMIN_PASSWORD
        ? cleanPassword === process.env.SUPER_ADMIN_PASSWORD
        : false;
    const valid =
      envOverride || verifyPassword(cleanPassword, adminUser.passwordHash, adminUser.passwordSalt);
    if (!valid) {
      return {
        ok: false as const,
        status: 401,
        error: 'Incorrect Super Admin password. Deletion cancelled.',
      };
    }
    return { ok: true as const };
  };

  // Pre-verify read-only so failed password attempts never write to disk/Mongo
  const currentDb = await getDatabase(true);
  const preCheck = checkPasswordForAdmin(
    currentDb.adminUsers.find((u) => u.id === params.adminId)
  );
  if (!preCheck.ok) {
    return { success: false as const, error: preCheck.error, status: preCheck.status };
  }

  return withTransaction((db) => {
    const txCheck = checkPasswordForAdmin(db.adminUsers.find((u) => u.id === params.adminId));
    if (!txCheck.ok) {
      return { success: false as const, error: txCheck.error, status: txCheck.status };
    }

    const purged = {
      orders: db.orders.length,
      orderItems: db.orderItems.length,
      customers: db.users.length,
      payments: db.payments.length,
      shipping: db.shipping.length,
      returns: db.returns.length,
      refunds: db.refunds.length,
      tickets: Array.isArray(db.supportMessages) ? db.supportMessages.length : 0,
      notifications:
        (Array.isArray(db.adminNotifications) ? db.adminNotifications.length : 0) +
        db.notifications.length,
    };

    db.orders = [];
    db.orderItems = [];
    db.orderStatusHistory = [];
    db.payments = [];
    db.shipping = [];
    db.returns = [];
    db.refunds = [];
    db.adminNotes = [];
    db.notifications = [];
    db.adminNotifications = [];
    db.users = [];
    db.supportMessages = [];

    const lastPurgedAt = new Date().toISOString();
    db.lastPurgedAt = lastPurgedAt;

    const storageMode: 'mongodb' | 'local-json' | 'local-memory-fallback' = isMongoConfigured()
      ? 'mongodb'
      : globalForDb.__stepstyleMemoryFallbackActive
      ? 'local-memory-fallback'
      : 'local-json';

    return {
      success: true as const,
      purged,
      lastPurgedAt,
      storageMode,
    };
  });
}

// ---------- Hero Banner Operations ----------

export async function getHeroBannersFromDb(): Promise<HeroBannerRecord[]> {
  const db = await getDatabase();
  const list = Array.isArray(db.heroBanners) && db.heroBanners.length > 0
    ? db.heroBanners
    : DEFAULT_HERO_BANNERS;
  return list.slice(0, 3).map((b, idx) => {
    const def = DEFAULT_HERO_BANNERS[idx] || DEFAULT_HERO_BANNERS[0];
    return {
      id: b.id || `slide-${idx + 1}`,
      image: sanitizeBannerImage(b.image, def.image),
      alt: String(b.alt || def.alt).trim().slice(0, 100) || def.alt,
      link: sanitizeStorefrontLink(b.link || def.link),
      updatedAt: b.updatedAt || def.updatedAt,
    };
  });
}

export async function updateHeroBannersInDb(
  slides: Array<{ id?: string; image: string; alt?: string; link: string }>
): Promise<HeroBannerRecord[]> {
  return withTransaction((db) => {
    const now = new Date().toISOString();
    const normalized: HeroBannerRecord[] = [0, 1, 2].map((idx) => {
      const def = DEFAULT_HERO_BANNERS[idx];
      const input = slides[idx];
      return {
        id: `slide-${idx + 1}`,
        image: sanitizeBannerImage(input?.image || '', def.image),
        alt: String(input?.alt || def.alt).trim().slice(0, 100) || def.alt,
        link: sanitizeStorefrontLink(input?.link || def.link),
        updatedAt: now,
      };
    });
    db.heroBanners = normalized;
    return normalized;
  });
}

export async function resetHeroBannersInDb(): Promise<HeroBannerRecord[]> {
  return withTransaction((db) => {
    const now = new Date().toISOString();
    const defaults = DEFAULT_HERO_BANNERS.map((b) => ({
      ...b,
      updatedAt: now,
    }));
    db.heroBanners = defaults;
    return defaults;
  });
}

// ---------- Lightweight Sync Signature Helpers ----------

export async function getAdminSyncSummaryFromDb(): Promise<{
  totalOrders: number;
  totalCustomers: number;
  latestOrderAt: string;
  latestCustomerAt: string;
}> {
  const db = await getDatabase(true);
  const customers = buildUnifiedCustomerProfiles(db);

  let latestOrderMs = 0;
  let latestOrderAt = '';
  for (const ord of db.orders) {
    const ts = new Date(ord.updatedAt || ord.createdAt || 0).getTime();
    if (ts > latestOrderMs) {
      latestOrderMs = ts;
      latestOrderAt = ord.updatedAt || ord.createdAt || '';
    }
  }

  let latestCustomerMs = 0;
  let latestCustomerAt = '';
  for (const cust of customers) {
    const ts = new Date(cust.lastOrderAt || cust.createdAt || 0).getTime();
    if (ts > latestCustomerMs) {
      latestCustomerMs = ts;
      latestCustomerAt = cust.lastOrderAt || cust.createdAt || '';
    }
  }

  return {
    totalOrders: db.orders.length,
    totalCustomers: customers.length,
    latestOrderAt,
    latestCustomerAt,
  };
}

export async function getStorefrontSignatureFromDb(): Promise<string> {
  const db = await getDatabase();
  const activeProducts = db.products.filter(
    (p) => !p.isDeleted && p.status !== 'inactive' && p.inStock && (p.stockQuantity ?? 1) > 0
  );
  const productSig = activeProducts
    .map((p) => `${p.id}:${p.price}:${p.mrp}:${p.stockQuantity}:${p.updatedAt || ''}`)
    .join('|');
  const banners = Array.isArray(db.heroBanners) ? db.heroBanners : DEFAULT_HERO_BANNERS;
  const bannerSig = banners
    .slice(0, 3)
    .map((b) => `${b.id}:${b.image}:${b.link}:${b.updatedAt || ''}`)
    .join('|');

  return crypto.createHash('sha1').update(`${productSig}##${bannerSig}`).digest('hex');
}

// ---------- Customer Auth & Profile Helpers ----------

export type SafeUserRecord = Omit<UserRecord, 'passwordHash' | 'passwordSalt'>;

function sanitizeUserRecord(user: UserRecord): SafeUserRecord {
  const { passwordHash: _h, passwordSalt: _s, ...safe } = user;
  return safe;
}

export async function registerCustomerInDb(params: {
  name: string;
  email?: string;
  phone?: string;
  identifier?: string;
  password: string;
}): Promise<
  | { success: true; user: SafeUserRecord }
  | { success: false; error: string; status: number }
> {
  const cleanName = params.name.trim().slice(0, 80);
  const rawIdentifier = String(params.identifier || '').trim();
  const identifierIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawIdentifier);
  const cleanEmail = normalizeCustomerEmail(
    params.email || (identifierIsEmail ? rawIdentifier : '')
  );
  const cleanPhone10 = normalizeCustomerPhone10(
    params.phone || (!identifierIsEmail ? rawIdentifier : '')
  );
  const cleanPassword = params.password;

  if (cleanName.length < 2) {
    return { success: false, error: 'Please enter your full name.', status: 400 };
  }
  const hasValidEmail = Boolean(cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));
  const hasValidPhone = cleanPhone10.length === 10;

  if (cleanEmail && !hasValidEmail) {
    return { success: false, error: 'Please enter a valid email address.', status: 400 };
  }
  if (!hasValidEmail && !hasValidPhone) {
    return {
      success: false,
      error: 'Please enter a valid email address or 10-digit mobile number.',
      status: 400,
    };
  }
  if (cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.', status: 400 };
  }

  return withTransaction((db) => {
    const emailMatch = hasValidEmail
      ? db.users.find((u) => normalizeCustomerEmail(u.email) === cleanEmail)
      : undefined;
    const phoneMatch = hasValidPhone
      ? db.users.find((u) => normalizeCustomerPhone10(u.phone) === cleanPhone10)
      : undefined;

    if (emailMatch?.passwordHash) {
      return {
        success: false,
        error: 'An account with this email already exists. Please sign in.',
        status: 409,
      };
    }
    if (phoneMatch?.passwordHash && phoneMatch.id !== emailMatch?.id) {
      return {
        success: false,
        error: 'An account with this mobile number already exists. Please sign in.',
        status: 409,
      };
    }

    const { hash, salt } = hashPassword(cleanPassword);
    const now = new Date().toISOString();
    let user = mergeDuplicateUsersInDb(db, cleanEmail, cleanPhone10);

    if (!user) {
      user = {
        id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        name: cleanName,
        email: cleanEmail,
        phone: hasValidPhone ? cleanPhone10 : 'N/A',
        passwordHash: hash,
        passwordSalt: salt,
        loginMethod: 'password',
        createdAt: now,
        lastLoginAt: now,
      };
      db.users.unshift(user);
    } else {
      user.name = cleanName;
      if (hasValidEmail) user.email = cleanEmail;
      if (hasValidPhone) user.phone = cleanPhone10;
      user.passwordHash = hash;
      user.passwordSalt = salt;
      user.loginMethod = 'password';
      user.lastLoginAt = now;
    }

    return { success: true, user: sanitizeUserRecord(user) };
  });
}

export async function authenticateCustomerInDb(params: {
  identifier: string;
  password: string;
}): Promise<
  | { success: true; user: SafeUserRecord }
  | { success: false; error: string; status: number }
> {
  const cleanIdent = params.identifier.trim().toLowerCase();
  const cleanPhone10 = normalizeCustomerPhone10(params.identifier);
  const cleanPassword = params.password;

  if (!cleanIdent || !cleanPassword) {
    return { success: false, error: 'Email/phone and password are required.', status: 400 };
  }

  return withTransaction((db) => {
    const idx = db.users.findIndex((u) => {
      const uEmail = normalizeCustomerEmail(u.email);
      const uPhone = normalizeCustomerPhone10(u.phone);
      return (uEmail && uEmail === cleanIdent) || (cleanPhone10 && uPhone === cleanPhone10);
    });

    if (idx === -1) {
      return { success: false, error: 'No customer account found with those details.', status: 401 };
    }

    const user = db.users[idx];
    if (!user.passwordHash || !user.passwordSalt) {
      return {
        success: false,
        error: 'This account uses Google or OTP sign-in. Sign in with OTP or reset your password first.',
        status: 401,
      };
    }

    if (!verifyPassword(cleanPassword, user.passwordHash, user.passwordSalt)) {
      return { success: false, error: 'Incorrect password. Please try again.', status: 401 };
    }

    db.users[idx].loginMethod = 'password';
    db.users[idx].lastLoginAt = new Date().toISOString();
    return { success: true, user: sanitizeUserRecord(db.users[idx]) };
  });
}

export async function authenticateCustomerViaOtpInDb(params: {
  identifier?: string;
  phone?: string;
  email?: string;
  name?: string;
}): Promise<
  | { success: true; user: SafeUserRecord }
  | { success: false; error: string; status: number }
> {
  const rawIdentifier = String(params.identifier || '').trim();
  const identifierIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawIdentifier);
  const cleanEmail = normalizeCustomerEmail(
    params.email || (identifierIsEmail ? rawIdentifier : '')
  );
  const cleanPhone10 = normalizeCustomerPhone10(
    params.phone || (!identifierIsEmail ? rawIdentifier : '')
  );
  const hasValidEmail = Boolean(cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));
  const hasValidPhone = cleanPhone10.length === 10;

  if (!hasValidEmail && !hasValidPhone) {
    return {
      success: false,
      error: 'Please enter a valid email address or 10-digit mobile number.',
      status: 400,
    };
  }

  return withTransaction((db) => {
    const now = new Date().toISOString();
    let user = mergeDuplicateUsersInDb(db, cleanEmail, cleanPhone10);
    const incomingName = (params.name || '').trim().slice(0, 80);

    if (!user) {
      user = {
        id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        name: incomingName || (hasValidEmail ? cleanEmail.split('@')[0] : 'StepStyle Member'),
        email: cleanEmail,
        phone: hasValidPhone ? cleanPhone10 : 'N/A',
        loginMethod: 'otp',
        createdAt: now,
        lastLoginAt: now,
      };
      db.users.unshift(user);
    } else {
      if (incomingName && isPlaceholderCustomerName(user.name, user.email)) {
        user.name = incomingName;
      }
      if (hasValidEmail && !user.email) user.email = cleanEmail;
      if (hasValidPhone) user.phone = cleanPhone10;
      user.loginMethod = 'otp';
      user.lastLoginAt = now;
    }

    return { success: true, user: sanitizeUserRecord(user) };
  });
}

export async function resetCustomerPasswordInDb(params: {
  identifier: string;
  newPassword: string;
}): Promise<
  | { success: true; email: string }
  | { success: false; error: string; status: number }
> {
  const cleanIdent = params.identifier.trim().toLowerCase();
  const cleanPhone10 = normalizeCustomerPhone10(params.identifier);
  const newPassword = params.newPassword;

  if (!cleanIdent) {
    return { success: false, error: 'Registered email or mobile number is required.', status: 400 };
  }
  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.', status: 400 };
  }

  return withTransaction((db) => {
    const idx = db.users.findIndex((u) => {
      const uEmail = normalizeCustomerEmail(u.email);
      const uPhone = normalizeCustomerPhone10(u.phone);
      return (uEmail && uEmail === cleanIdent) || (cleanPhone10 && uPhone === cleanPhone10);
    });

    if (idx === -1) {
      return {
        success: false,
        error: 'No customer account registered with that email or mobile number.',
        status: 404,
      };
    }

    const { hash, salt } = hashPassword(newPassword);
    db.users[idx].passwordHash = hash;
    db.users[idx].passwordSalt = salt;
    return { success: true, email: db.users[idx].email || db.users[idx].phone };
  });
}

// ---------- Support Inbox Operations ----------

export async function createSupportMessageInDb(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<SupportMessageRecord> {
  return withTransaction((db) => {
    if (!Array.isArray(db.supportMessages)) {
      db.supportMessages = [];
    }
    const now = new Date().toISOString();
    const ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
    const record: SupportMessageRecord = {
      id: `sup-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      ticketNumber,
      name: params.name.trim().slice(0, 100),
      email: params.email.trim().toLowerCase().slice(0, 140),
      subject: params.subject.trim().slice(0, 180),
      message: params.message.trim().slice(0, 2000),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    db.supportMessages.unshift(record);

    pushAdminNotification(db, {
      type: 'support_message',
      orderId: record.id,
      orderNumber: ticketNumber,
      customerName: record.name,
      customerPhone: record.email,
      totalAmount: 0,
      paymentMethod: record.subject,
      paymentStatus: 'Open',
      itemCount: 1,
      primaryItemName: record.subject,
      message: `Support ticket ${ticketNumber} from ${record.name}: ${record.subject}`,
      createdAt: now,
    });

    return record;
  });
}

export async function getSupportMessagesFromDb(): Promise<SupportMessageRecord[]> {
  const db = await getDatabase(true);
  const list = Array.isArray(db.supportMessages) ? db.supportMessages : [];
  return [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function updateSupportMessageInDb(params: {
  id: string;
  status?: 'open' | 'in_progress' | 'resolved';
  adminNote?: string;
  handledByAdminName?: string;
}): Promise<SupportMessageRecord | null> {
  return withTransaction((db) => {
    if (!Array.isArray(db.supportMessages)) {
      db.supportMessages = [];
    }
    const idx = db.supportMessages.findIndex((m) => m.id === params.id);
    if (idx === -1) return null;

    const current = db.supportMessages[idx];
    if (params.status) current.status = params.status;
    if (params.adminNote !== undefined) {
      current.adminNote = params.adminNote.trim().slice(0, 1000);
    }
    if (params.handledByAdminName) {
      current.handledByAdminName = params.handledByAdminName;
    }
    current.updatedAt = new Date().toISOString();
    return current;
  });
}

// ---------- Direct Local Database Explorer Helpers (Super Admin Only) ----------

export type DatabaseCollectionKey =
  | 'products'
  | 'productVariants'
  | 'orders'
  | 'orderItems'
  | 'users'
  | 'payments'
  | 'shipping'
  | 'returns'
  | 'refunds'
  | 'supportMessages'
  | 'categories'
  | 'brands'
  | 'heroBanners'
  | 'adminNotifications'
  | 'adminUsers';

const COLLECTION_META: Array<{ key: DatabaseCollectionKey; label: string }> = [
  { key: 'products', label: 'Products' },
  { key: 'productVariants', label: 'Size & Color Variants' },
  { key: 'orders', label: 'Orders' },
  { key: 'orderItems', label: 'Order Line Items' },
  { key: 'users', label: 'Customers (Users)' },
  { key: 'payments', label: 'Payments' },
  { key: 'shipping', label: 'Shipping & Tracking' },
  { key: 'returns', label: 'Returns' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'supportMessages', label: 'Support Inbox' },
  { key: 'categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
  { key: 'heroBanners', label: 'Hero Banners' },
  { key: 'adminNotifications', label: 'Admin Notifications' },
  { key: 'adminUsers', label: 'Admin Accounts' },
];

export async function getLocalDatabaseDiagnostics() {
  const db = await getDatabase(true);
  const storage = await resolveStorageTarget();
  let fileSizeBytes = 0;
  let lastModifiedAt: string | null = null;

  try {
    const stat = await fs.stat(storage.dbPath);
    fileSizeBytes = stat.size;
    lastModifiedAt = stat.mtime.toISOString();
  } catch {
    fileSizeBytes = Buffer.byteLength(JSON.stringify(db), 'utf8');
  }

  const storageMode: 'mongodb' | 'local-json' | 'local-memory-fallback' = isMongoConfigured()
    ? 'mongodb'
    : globalForDb.__stepstyleMemoryFallbackActive
    ? 'local-memory-fallback'
    : 'local-json';

  const collections = COLLECTION_META.map(({ key, label }) => {
    const list = db[key];
    return {
      key,
      label,
      count: Array.isArray(list) ? list.length : 0,
    };
  });

  return {
    storageMode,
    dbPath: storage.dbPath,
    bundledWritable: storage.bundledWritable,
    memoryFallbackActive: Boolean(globalForDb.__stepstyleMemoryFallbackActive),
    fileSizeBytes,
    lastModifiedAt,
    version: db.version,
    collections,
  };
}

function redactSensitiveFields<T>(collectionKey: DatabaseCollectionKey, items: T[]): unknown[] {
  if (collectionKey === 'adminUsers' || collectionKey === 'users') {
    return items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const copy = { ...(item as Record<string, unknown>) };
      if ('passwordHash' in copy && copy.passwordHash) {
        copy.passwordHash = '[REDACTED]';
      }
      if ('passwordSalt' in copy && copy.passwordSalt) {
        copy.passwordSalt = '[REDACTED]';
      }
      return copy;
    });
  }
  return items;
}

export async function getLocalDatabaseCollectionPreview(
  collectionKey: DatabaseCollectionKey,
  options?: { search?: string; limit?: number; offset?: number }
) {
  const db = await getDatabase(true);
  const validMeta = COLLECTION_META.find((m) => m.key === collectionKey);
  if (!validMeta) {
    throw new Error(`Unsupported database collection "${collectionKey}".`);
  }

  const rawList = Array.isArray(db[collectionKey]) ? (db[collectionKey] as unknown[]) : [];
  const safeList = redactSensitiveFields(collectionKey, rawList);

  const q = (options?.search || '').trim().toLowerCase();
  const filtered = q
    ? safeList.filter((row) => JSON.stringify(row).toLowerCase().includes(q))
    : safeList;

  const limit = Math.max(1, Math.min(200, Number(options?.limit) || 25));
  const offset = Math.max(0, Number(options?.offset) || 0);

  return {
    collection: validMeta.key,
    label: validMeta.label,
    totalCount: rawList.length,
    filteredCount: filtered.length,
    limit,
    offset,
    records: filtered.slice(offset, offset + limit),
  };
}

export async function exportLocalDatabaseSnapshot(): Promise<DatabaseSchema> {
  const db = await getDatabase(true);
  const clone = JSON.parse(JSON.stringify(db)) as DatabaseSchema;

  clone.adminUsers = clone.adminUsers.map((a) => ({
    ...a,
    passwordHash: '[REDACTED]',
    passwordSalt: '[REDACTED]',
  }));

  clone.users = clone.users.map((u) => ({
    ...u,
    ...(u.passwordHash ? { passwordHash: '[REDACTED]' } : {}),
    ...(u.passwordSalt ? { passwordSalt: '[REDACTED]' } : {}),
  }));

  return clone;
}

export async function restoreLocalDatabaseSnapshot(rawSnapshot: unknown) {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') {
    throw new Error('Snapshot must be a valid JSON object.');
  }

  const candidate = rawSnapshot as Partial<DatabaseSchema>;
  if (candidate.version !== 1) {
    throw new Error('Invalid database snapshot: "version" must equal 1.');
  }

  const requiredArrays: Array<keyof DatabaseSchema> = [
    'products',
    'orders',
    'orderItems',
    'users',
  ];
  for (const field of requiredArrays) {
    if (!Array.isArray(candidate[field])) {
      throw new Error(`Invalid database snapshot: missing "${field}" array.`);
    }
  }

  await withTransaction((db) => {
    // Always preserve server-side admin credentials & existing customer password hashes when backup redacted them
    const existingAdminMap = new Map(db.adminUsers.map((a) => [a.id, a]));
    const existingUserMap = new Map(db.users.map((u) => [u.id, u]));

    const incomingUsers = (candidate.users || []).map((u) => {
      const prev = existingUserMap.get(u.id);
      const next = { ...u };
      if (
        (next.passwordHash === '[REDACTED]' || !next.passwordHash) &&
        prev?.passwordHash
      ) {
        next.passwordHash = prev.passwordHash;
        next.passwordSalt = prev.passwordSalt;
      }
      return next;
    });

    const incomingAdmins = Array.isArray(candidate.adminUsers)
      ? candidate.adminUsers
          .map((a) => {
            const prev = existingAdminMap.get(a.id);
            if (!prev && (a.passwordHash === '[REDACTED]' || !a.passwordHash)) {
              return null;
            }
            return prev && (a.passwordHash === '[REDACTED]' || !a.passwordHash)
              ? { ...a, passwordHash: prev.passwordHash, passwordSalt: prev.passwordSalt }
              : a;
          })
          .filter((a): a is AdminUserRecord => Boolean(a))
      : [];

    // Ensure at least current active Super Admins remain intact
    for (const prevAdmin of db.adminUsers) {
      if (!incomingAdmins.some((a) => a.id === prevAdmin.id)) {
        incomingAdmins.push(prevAdmin);
      }
    }

    db.users = incomingUsers;
    db.adminUsers = incomingAdmins;
    db.categories = Array.isArray(candidate.categories) ? candidate.categories : db.categories;
    db.brands = Array.isArray(candidate.brands) ? candidate.brands : db.brands;
    db.products = candidate.products || db.products;
    db.productImages = Array.isArray(candidate.productImages) ? candidate.productImages : [];
    db.productVariants = Array.isArray(candidate.productVariants) ? candidate.productVariants : [];
    db.orders = candidate.orders || [];
    db.orderItems = candidate.orderItems || [];
    db.orderStatusHistory = Array.isArray(candidate.orderStatusHistory)
      ? candidate.orderStatusHistory
      : [];
    db.payments = Array.isArray(candidate.payments) ? candidate.payments : [];
    db.shipping = Array.isArray(candidate.shipping) ? candidate.shipping : [];
    db.returns = Array.isArray(candidate.returns) ? candidate.returns : [];
    db.refunds = Array.isArray(candidate.refunds) ? candidate.refunds : [];
    db.adminNotes = Array.isArray(candidate.adminNotes) ? candidate.adminNotes : [];
    db.notifications = Array.isArray(candidate.notifications) ? candidate.notifications : [];
    db.adminNotifications = Array.isArray(candidate.adminNotifications)
      ? candidate.adminNotifications
      : [];
    db.heroBanners =
      Array.isArray(candidate.heroBanners) && candidate.heroBanners.length > 0
        ? candidate.heroBanners
        : DEFAULT_HERO_BANNERS.map((b) => ({ ...b }));
    db.supportMessages = Array.isArray(candidate.supportMessages)
      ? candidate.supportMessages
      : [];
    if (typeof candidate.lastPurgedAt === 'string' && candidate.lastPurgedAt.trim()) {
      db.lastPurgedAt = candidate.lastPurgedAt.trim();
    }
  });

  return getLocalDatabaseDiagnostics();
}
