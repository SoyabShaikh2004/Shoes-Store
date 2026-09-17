import { Metadata } from 'next';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { getProducts, getCategories } from '@/lib/data';
import ProductCard from '@/components/ProductCard';

export const metadata: Metadata = {
  title: 'All Products | StepStyle',
  description: 'Browse our collection of premium shoes',
};

interface ProductsPageProps {
  searchParams: { category?: string };
}

async function ProductsList({ category }: { category?: string }) {
  const allProducts = await getProducts();
  // Recategorize "Walking" products as "Running" instead of filtering them out
  const recategorizedProducts = allProducts.map(product => 
    product.category === "Walking" 
      ? {...product, category: "Running"} 
      : product
  );
  
  const products = category
    ? recategorizedProducts.filter(product => product.category === category)
    : recategorizedProducts;

  if (products.length === 0) {
    return (
      <div className="py-6 sm:py-8 text-center">
        <p className="text-base sm:text-lg text-gray-600">
          {category
            ? `No shoes found in the ${category} category.`
            : 'No shoes found.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category } = searchParams;
  const categories = await getCategories();
  const filteredCategories = categories.filter(cat => cat !== "Walking");

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8 max-w-7xl">
      <h1 className="mb-6 sm:mb-8 text-2xl sm:text-3xl md:text-4xl font-extrabold text-center text-gray-900 tracking-tight">
        {category ? `${category} Shoes` : 'All Products'}
      </h1>

      {/* Categories */}
      <div className="mb-6 sm:mb-8 overflow-x-auto no-scrollbar pb-2">
        <div className="flex flex-nowrap sm:flex-wrap gap-2 items-center justify-start sm:justify-center">
          <Link 
            href="/products" 
            className={`rounded-xl ${!category ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'} px-4 py-2 text-xs sm:text-sm font-bold min-h-[40px] inline-flex items-center transition-all whitespace-nowrap`}
          >
            All Footwear
          </Link>
          {filteredCategories.map((cat) => (
            <Link 
              key={cat} 
              href={`/products?category=${cat}`}
              className={`rounded-xl ${category === cat ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'} px-4 py-2 text-xs sm:text-sm font-bold min-h-[40px] inline-flex items-center transition-all whitespace-nowrap`}
            >
              {cat}
            </Link>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <Suspense fallback={
        <div className="py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
                <div className="h-52 sm:h-56 rounded-xl bg-gray-100 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                  <div className="h-6 bg-gray-100 rounded w-1/3"></div>
                  <div className="h-10 bg-gray-100 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      }>
        <ProductsList category={category} />
      </Suspense>
    </div>
  );
}