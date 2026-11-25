import { Metadata } from 'next';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { getProducts, getCategories } from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import StorefrontLiveBridge from '@/components/StorefrontLiveBridge';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'All Products | StepStyle',
  description: 'Browse our collection of premium shoes',
};

interface ProductsPageProps {
  searchParams: { category?: string; search?: string };
}

async function ProductsList({ category, search }: { category?: string; search?: string }) {
  const allProducts = await getProducts();
  // Only show active and in-stock shoes, recategorizing legacy "Walking" as "Running"
  const activeProducts = allProducts
    .filter((p) => p.status !== 'inactive' && p.inStock && (p.stockQuantity ?? 1) > 0)
    .map((product) =>
      product.category === 'Walking'
        ? { ...product, category: 'Running' }
        : product
    );

  let products = category
    ? activeProducts.filter((product) => product.category.toLowerCase() === category.toLowerCase())
    : activeProducts;

  const q = (search || '').trim().toLowerCase();
  if (q) {
    products = products.filter((p) => {
      const haystack = [
        p.name,
        p.brand || '',
        p.category,
        p.shoeType || '',
        p.gender || '',
        ...(p.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (products.length === 0) {
    return (
      <div className="py-10 sm:py-12 text-center bg-slate-50 rounded-2xl border border-slate-200 max-w-md mx-auto px-4">
        <p className="text-base sm:text-lg font-bold text-slate-800">
          {q
            ? `No shoes found matching "${search}".`
            : category
            ? `No shoes found in the ${category} category.`
            : 'No shoes found.'}
        </p>
        <Link
          href="/products"
          className="mt-4 inline-flex items-center justify-center min-h-[44px] px-5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold"
        >
          View All Available Shoes
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category, search } = searchParams;
  const categories = await getCategories();
  const filteredCategories = categories.filter((cat) => cat !== 'Walking');

  return (
    <div className="container mx-auto px-3.5 sm:px-4 py-4 sm:py-6 md:py-8 max-w-7xl">
      <StorefrontLiveBridge />
      <h1 className="mb-4 sm:mb-6 text-xl sm:text-3xl md:text-4xl font-extrabold text-center text-gray-900 tracking-tight">
        {search ? `Results for "${search}"` : category ? `${category} Shoes` : 'All Products'}
      </h1>

      {/* Categories */}
      <div className="mb-5 sm:mb-8 overflow-x-auto no-scrollbar pb-2">
        <div className="flex flex-nowrap sm:flex-wrap gap-2 items-center justify-start sm:justify-center">
          <Link
            href="/products"
            className={`rounded-xl ${
              !category && !search
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
            } px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] inline-flex items-center transition-all whitespace-nowrap shrink-0`}
          >
            All Footwear
          </Link>
          {filteredCategories.map((cat) => (
            <Link
              key={cat}
              href={`/products?category=${encodeURIComponent(cat)}`}
              className={`rounded-xl ${
                category === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
              } px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] inline-flex items-center transition-all whitespace-nowrap shrink-0`}
            >
              {cat}
            </Link>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <Suspense
        fallback={
          <div className="py-6 sm:py-10">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
                  <div className="h-36 sm:h-52 rounded-xl bg-gray-100 mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                    <div className="h-5 bg-gray-100 rounded w-1/3"></div>
                    <div className="h-10 bg-gray-100 rounded-xl"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <ProductsList category={category} search={search} />
      </Suspense>
    </div>
  );
}