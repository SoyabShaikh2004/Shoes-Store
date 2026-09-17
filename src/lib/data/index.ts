import { promises as fs } from 'fs';
import path from 'path';

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  mrp?: number;
  imagePath: string;
  images?: string[];
  category: string;
  inStock: boolean;
  colors: string[];
  sizes: number[];
  featured?: boolean;
  brand?: string;
  createdAt?: string;
  status?: 'active' | 'inactive';
  isDeleted?: boolean;
};

// Cache the products data
let productsCache: Product[] | null = null;

const getProductsFilePath = () => path.join(process.cwd(), 'src/lib/data/products.json');
const getDefaultProductsFilePath = () => path.join(process.cwd(), 'src/lib/data/default-products.json');

export async function getProducts(forceRefresh = false): Promise<Product[]> {
  if (!forceRefresh && productsCache !== null) {
    return productsCache;
  }

  try {
    const filePath = getProductsFilePath();
    const data = await fs.readFile(filePath, 'utf8');
    const products: Product[] = JSON.parse(data);
    // Sanitize and filter out unwanted, deleted, inactive, or corrupted products
    const validProducts = products.filter(
      (p) =>
        p &&
        p.id &&
        p.name &&
        p.name.trim() !== '' &&
        p.price > 0 &&
        !p.isDeleted &&
        p.status !== 'inactive'
    );
    productsCache = validProducts;
    return validProducts;
  } catch (error) {
    // If products.json is missing or corrupted, attempt fallback
    try {
      const defaultPath = getDefaultProductsFilePath();
      const defaultData = await fs.readFile(defaultPath, 'utf8');
      const products: Product[] = JSON.parse(defaultData);
      const validProducts = products.filter(
        (p) =>
          p &&
          p.id &&
          p.name &&
          p.name.trim() !== '' &&
          p.price > 0 &&
          !p.isDeleted &&
          p.status !== 'inactive'
      );
      productsCache = validProducts;
      return validProducts;
    } catch {
      return [];
    }
  }
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((product) => product.id === id);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((product) => product.category === category);
}

export async function getCategories(): Promise<string[]> {
  const products = await getProducts();
  const categories = new Set(products.map((product) => product.category));
  return Array.from(categories);
}

export async function saveProducts(products: Product[]): Promise<boolean> {
  try {
    const filePath = getProductsFilePath();
    await fs.writeFile(filePath, JSON.stringify(products, null, 2), 'utf8');
    productsCache = products;
    return true;
  } catch (error) {
    console.error('Failed to save products:', error);
    return false;
  }
}

export async function createProduct(productData: Omit<Product, 'id'>): Promise<Product> {
  const products = await getProducts(true);
  const nextId = products.length > 0 ? Math.max(...products.map(p => p.id || 0)) + 1 : 1;
  
  const newProduct: Product = {
    ...productData,
    id: nextId,
    createdAt: new Date().toISOString(),
  };

  const updatedProducts = [newProduct, ...products];
  await saveProducts(updatedProducts);
  return newProduct;
}

export async function updateProduct(id: number, productData: Partial<Product>): Promise<Product | null> {
  const products = await getProducts(true);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return null;

  const existing = products[index];
  const updated: Product = {
    ...existing,
    ...productData,
    id, // Keep the same ID
  };

  products[index] = updated;
  await saveProducts(products);
  return updated;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const products = await getProducts(true);
  const updatedProducts = products.filter(p => p.id !== id);
  if (updatedProducts.length === products.length) return false;

  await saveProducts(updatedProducts);
  return true;
}

export async function resetProductsToDefault(): Promise<Product[]> {
  try {
    const defaultPath = getDefaultProductsFilePath();
    const defaultData = await fs.readFile(defaultPath, 'utf8');
    const defaultProducts: Product[] = JSON.parse(defaultData);
    await saveProducts(defaultProducts);
    return defaultProducts;
  } catch (error) {
    console.error('Failed to reset default products:', error);
    return [];
  }
}
