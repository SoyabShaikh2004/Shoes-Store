import { promises as fs } from 'fs';
import path from 'path';
import {
  createProductInDb,
  deleteProductInDb,
  getProductsFromDb,
  updateProductInDb,
  withTransaction,
} from '@/lib/db/store';

export type Product = {
  id: number;
  sku?: string;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  discountPercentage?: number;
  stockQuantity?: number;
  imagePath: string;
  images?: string[];
  category: string;
  inStock: boolean;
  colors: string[];
  sizes: number[];
  tags?: string[];
  featured?: boolean;
  brand?: string;
  gender?: 'Men' | 'Women' | 'Unisex' | 'Kids';
  shoeType?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'inactive';
  isDeleted?: boolean;
};

const getProductsFilePath = () => path.join(process.cwd(), 'src/lib/data/products.json');
const getDefaultProductsFilePath = () =>
  path.join(process.cwd(), 'src/lib/data/default-products.json');

export async function getProducts(includeInactive = false): Promise<Product[]> {
  try {
    const dbProducts = await getProductsFromDb(includeInactive);
    if (dbProducts.length > 0) {
      return dbProducts.filter(
        (p) =>
          p &&
          p.id &&
          p.name &&
          p.name.trim() !== '' &&
          p.price > 0 &&
          !p.isDeleted &&
          (includeInactive || p.status !== 'inactive')
      );
    }
  } catch {
    // fallback to file read below
  }

  try {
    const filePath = getProductsFilePath();
    const data = await fs.readFile(filePath, 'utf8');
    const products: Product[] = JSON.parse(data);
    return products.filter(
      (p) =>
        p &&
        p.id &&
        p.name &&
        p.name.trim() !== '' &&
        p.price > 0 &&
        !p.isDeleted &&
        (includeInactive || p.status !== 'inactive')
    );
  } catch {
    try {
      const defaultPath = getDefaultProductsFilePath();
      const defaultData = await fs.readFile(defaultPath, 'utf8');
      const products: Product[] = JSON.parse(defaultData);
      return products.filter(
        (p) =>
          p &&
          p.id &&
          p.name &&
          p.name.trim() !== '' &&
          p.price > 0 &&
          !p.isDeleted &&
          (includeInactive || p.status !== 'inactive')
      );
    } catch {
      return [];
    }
  }
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const products = await getProducts(false);
  return products.find((product) => product.id === id);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const products = await getProducts(false);
  return products.filter((product) => product.category === category);
}

export async function getCategories(): Promise<string[]> {
  const products = await getProducts(false);
  const categories = new Set(products.map((product) => product.category));
  return Array.from(categories);
}

export async function saveProducts(products: Product[]): Promise<boolean> {
  try {
    const filePath = getProductsFilePath();
    await fs.writeFile(filePath, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save products:', error);
    return false;
  }
}

export async function createProduct(productData: Omit<Product, 'id'>): Promise<Product> {
  return createProductInDb(productData);
}

export async function updateProduct(
  id: number,
  productData: Partial<Product>
): Promise<Product | null> {
  return updateProductInDb(id, productData);
}

export async function deleteProduct(id: number): Promise<boolean> {
  return deleteProductInDb(id);
}

export async function resetProductsToDefault(): Promise<Product[]> {
  try {
    const defaultPath = getDefaultProductsFilePath();
    const defaultData = await fs.readFile(defaultPath, 'utf8');
    const defaultProducts: Product[] = JSON.parse(defaultData);

    await withTransaction((db) => {
      const now = new Date().toISOString();
      db.products = defaultProducts.map((p) => ({
        id: p.id,
        sku: p.sku || `STEP-${String(p.id).padStart(4, '0')}`,
        name: p.name,
        description: p.description || '',
        price: p.price,
        mrp: p.mrp || Math.round(p.price * 1.25),
        discountPercentage:
          p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
        stockQuantity: p.inStock === false ? 0 : 35,
        categoryId: `cat-${(p.category || 'casual').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        category: p.category || 'Casual',
        brandId: `brand-${(p.brand || 'stepstyle').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        brand: p.brand || 'StepStyle',
        imagePath: p.imagePath,
        images: p.images && p.images.length > 0 ? p.images : [p.imagePath],
        colors: p.colors || ['Black/White'],
        sizes: p.sizes || [7, 8, 9, 10, 11],
        tags: p.tags || [p.category || 'Casual', p.brand || 'StepStyle'],
        featured: Boolean(p.featured),
        inStock: p.inStock !== false,
        status: 'active',
        gender: p.gender || 'Men',
        shoeType: p.shoeType || p.category || 'Sneakers',
        isDeleted: false,
        createdAt: p.createdAt || now,
        updatedAt: now,
      }));
    });

    return getProducts(true);
  } catch (error) {
    console.error('Failed to reset default products:', error);
    return [];
  }
}
