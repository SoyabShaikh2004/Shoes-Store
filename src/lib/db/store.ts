import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AdminNoteRecord,
  AdminRole,
  AdminUserRecord,
  BrandRecord,
  CategoryRecord,
  DatabaseSchema,
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
  UserRecord,
} from './schema';

const DB_FILE_PATH = path.join(process.cwd(), 'src/lib/data/database.json');
const PRODUCTS_FILE_PATH = path.join(process.cwd(), 'src/lib/data/products.json');
const DEFAULT_PRODUCTS_FILE_PATH = path.join(
  process.cwd(),
  'src/lib/data/default-products.json'
);
const ORDERS_FILE_PATH = path.join(process.cwd(), 'src/lib/data/orders.json');

// Serialize all database mutations through a single process-wide promise mutex
const globalForDb = globalThis as typeof globalThis & {
  __stepstyleDbMutex?: Promise<unknown>;
};

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

async function bootstrapDatabase(): Promise<DatabaseSchema> {
  const existingDb = await readJsonSafe<DatabaseSchema | null>(DB_FILE_PATH, null);
  if (existingDb && existingDb.version === 1 && Array.isArray(existingDb.products)) {
    return existingDb;
  }

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

    const status: OrderStatus = ro.status || mapLegacyStageToStatus(ro.stage, ro.paymentStatus);
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
  };

  await writeAtomicJson(DB_FILE_PATH, db);
  await syncLegacyFiles(db);
  return db;
}

export async function getDatabase(): Promise<DatabaseSchema> {
  return runLocked(() => bootstrapDatabase());
}

export async function withTransaction<T>(
  mutator: (db: DatabaseSchema) => Promise<T> | T
): Promise<T> {
  return runLocked(async () => {
    const db = await bootstrapDatabase();
    // Clone to preserve rollback safety on thrown errors
    const workingCopy = JSON.parse(JSON.stringify(db)) as DatabaseSchema;
    const result = await mutator(workingCopy);
    await writeAtomicJson(DB_FILE_PATH, workingCopy);
    await syncLegacyFiles(workingCopy);
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

function rebuildProductRelations(db: DatabaseSchema, product: ProductRecord): void {
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

  db.productVariants = db.productVariants.filter((v) => v.productId !== product.id);
  const perVariantStock =
    product.stockQuantity > 0
      ? Math.max(
          1,
          Math.floor(
            product.stockQuantity /
              Math.max(1, product.sizes.length * product.colors.length)
          )
        )
      : 0;

  for (const size of product.sizes) {
    for (const color of product.colors) {
      db.productVariants.push({
        id: `var-${product.id}-${size}-${slugify(color)}`,
        productId: product.id,
        sku: `${product.sku}-${size}-${slugify(color).toUpperCase().slice(0, 4)}`,
        size,
        color,
        stockQuantity: perVariantStock,
      });
    }
  }
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
    rebuildProductRelations(db, updated);
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
    if (item.selectedSize !== undefined) {
      const varIdx = db.productVariants.findIndex(
        (v) =>
          v.productId === item.productId &&
          v.size === item.selectedSize &&
          (!item.selectedColor || v.color.toLowerCase() === item.selectedColor.toLowerCase())
      );
      if (varIdx >= 0) {
        db.productVariants[varIdx].stockQuantity = Math.max(
          0,
          db.productVariants[varIdx].stockQuantity - item.quantity
        );
      }
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
    if (item.selectedSize !== undefined) {
      const varIdx = db.productVariants.findIndex(
        (v) =>
          v.productId === item.productId &&
          v.size === item.selectedSize &&
          (!item.selectedColor || v.color.toLowerCase() === item.selectedColor.toLowerCase())
      );
      if (varIdx >= 0) {
        db.productVariants[varIdx].stockQuantity += item.quantity;
      }
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

    const orderNumber = input.orderId
      ? normalizeOrderNumber(input.orderId)
      : generateUniqueOrderNumber(existingNumbers);
    const orderId = `ord-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const cleanEmail = (input.customer.email || '').trim().toLowerCase();
    const cleanPhone = (input.customer.phone || 'N/A').trim();
    let user = db.users.find(
      (u) =>
        (cleanEmail && u.email === cleanEmail) ||
        (cleanPhone !== 'N/A' && u.phone === cleanPhone)
    );
    if (!user) {
      user = {
        id: `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        name: input.customer.name || 'Customer',
        email: cleanEmail,
        phone: cleanPhone,
        defaultAddress: input.customer.address,
        defaultPincode: input.customer.pincode,
        createdAt: now,
        lastOrderAt: now,
      };
      db.users.push(user);
    } else {
      user.lastOrderAt = now;
      user.defaultAddress = input.customer.address || user.defaultAddress;
      user.defaultPincode = input.customer.pincode || user.defaultPincode;
    }

    const payStatus = mapPaymentStatusFromOrder(input.paymentStatus);
    const initialStatus: OrderStatus =
      payStatus === 'Failed'
        ? 'Payment Failed'
        : payStatus === 'Paid'
        ? 'Order Confirmed'
        : 'Order Placed';

    const shippingFee = Number(input.shippingFee) || 0;
    const totalAmount = Number(input.totalAmount);
    const subtotal = Math.max(0, totalAmount - shippingFee);

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

    // Create OrderItems
    input.items.forEach((item, idx) => {
      const prod = db.products.find((p) => p.id === Number(item.id));
      const qty = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.price) || prod?.price || 0;
      db.orderItems.push({
        id: `oi-${orderId}-${idx + 1}`,
        orderId,
        productId: Number(item.id),
        sku: prod?.sku || `STEP-${String(item.id).padStart(4, '0')}`,
        name: item.name || prod?.name || 'Footwear',
        imagePath: item.imagePath || prod?.imagePath || '/images/Empty-cart.jpg',
        brand: item.brand || prod?.brand || 'StepStyle',
        category: item.category || prod?.category || 'Sneakers',
        selectedSize: item.selectedSize ? Number(item.selectedSize) : undefined,
        selectedColor: item.selectedColor,
        quantity: qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      });
    });

    // Deduct stock immediately when confirmed
    if (initialStatus === 'Order Confirmed') {
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

    return { orderView: assembleFullOrder(db, newOrder), duplicate: false };
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
  const db = await getDatabase();

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
      ['Order Cancelled', 'Returned'].includes(params.status) &&
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

    return assembleFullOrder(db, order);
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

export async function getAdminAnalyticsAndEntities() {
  const db = await getDatabase();
  const customers = db.users.map((u) => {
    const userOrders = db.orders.filter((o) => o.userId === u.id);
    const totalSpent = userOrders
      .filter((o) => !['Order Cancelled', 'Payment Failed', 'Refunded'].includes(o.status))
      .reduce((sum, o) => sum + o.totalAmount, 0);
    return {
      ...u,
      ordersCount: userOrders.length,
      totalSpent,
      lastOrderNumber: userOrders[0]?.orderNumber,
    };
  });

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
