import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductById } from '@/lib/data';
import ProductImages from '@/components/ProductImages';
import ProductDetailActions from '@/components/ProductDetailActions';
import StorefrontLiveBridge from '@/components/StorefrontLiveBridge';
import { resolveProductGallery } from '@/lib/productImages';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface ProductDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const product = await getProductById(Number(params.id));
  
  if (!product) {
    return {
      title: 'Product Not Found | StepStyle',
      description: 'The requested product could not be found',
    };
  }
  
  return {
    title: `${product.name} | StepStyle`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const product = await getProductById(Number(params.id));
  
  if (!product) {
    notFound();
  }
  
  const productImages = resolveProductGallery(product);

  const stockQty = product.stockQuantity ?? 1;
  const isAvailable = Boolean(product.inStock && product.status !== 'inactive' && stockQty > 0);
  const hasDiscount = product.mrp && product.mrp > product.price;
  const discountAmount = hasDiscount ? product.mrp! - product.price : 0;
  const discountPercent = hasDiscount
    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
    : 0;
  
  return (
    <div className="container mx-auto max-w-7xl px-3.5 sm:px-4 py-4 sm:py-6 md:py-8">
      <StorefrontLiveBridge />
      {/* Breadcrumb Navigation */}
      <div className="mb-4">
        <nav aria-label="Breadcrumb" className="flex text-xs sm:text-sm">
          <ol className="flex flex-wrap items-center gap-y-1 space-x-1 md:space-x-2 text-gray-500">
            <li className="inline-flex items-center">
              <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-1 sm:mx-2 text-gray-400">/</span>
                <Link href="/products" className="hover:text-indigo-600 transition-colors">Products</Link>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-1 sm:mx-2 text-gray-400">/</span>
                <span className="text-gray-400">{product.category}</span>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <span className="mx-1 sm:mx-2 text-gray-400">/</span>
                <span className="text-gray-900 font-medium truncate max-w-[150px] sm:max-w-[300px]">
                  {product.name}
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
        {/* Product Images */}
        <div>
          <ProductImages slides={productImages} productName={product.name} />
        </div>
        
        {/* Product Details */}
        <div className="flex flex-col space-y-4 sm:space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                {product.brand || 'StepStyle'}
              </span>
              <span className="inline-block rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {product.category}
              </span>
              {isAvailable ? (
                <span className="inline-block rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  {product.stockQuantity !== undefined && product.stockQuantity <= 8
                    ? `Only ${product.stockQuantity} left`
                    : 'In Stock'}
                </span>
              ) : (
                <span className="inline-block rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-800">
                  Out of Stock
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight">
              {product.name}
            </h1>
            
            {/* Pricing Section with MRP */}
            <div className="mt-3 flex items-baseline flex-wrap gap-2 sm:gap-3 tabular-nums">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              
              {hasDiscount && (
                <>
                  <span className="text-lg sm:text-xl text-gray-400 line-through">
                    MRP ₹{product.mrp!.toLocaleString('en-IN')}
                  </span>
                  <span className="rounded-full bg-rose-100 border border-rose-200 px-3 py-0.5 text-xs sm:text-sm font-bold text-rose-700">
                    Save ₹{discountAmount.toLocaleString('en-IN')} ({discountPercent}% OFF)
                  </span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">Inclusive of all taxes</p>
          </div>
          
          {/* Description */}
          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900 mb-2">
              Product Overview
            </h2>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              {product.description}
            </p>
          </div>
          
          {/* Product options and actions (Size, Color, Add to Cart, Buy Now) */}
          <div className="border-t border-gray-100 pt-4">
            <ProductDetailActions product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}
