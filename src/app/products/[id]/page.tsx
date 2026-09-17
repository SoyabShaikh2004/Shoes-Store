import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductById } from '@/lib/data';
import ProductImages from '@/components/ProductImages';
import ProductDetailActions from '@/components/ProductDetailActions';
import Link from 'next/link';

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
  
  // Function to get appropriate image slides based on product data
  const getProductImageSlides = (productId: number, imagePath: string, customImages?: string[]) => {
    // 1. If product has dedicated images array, use them
    if (customImages && customImages.length > 0) {
      return customImages;
    }

    // 2. If imagePath is a direct uploaded file or URL
    if (
      imagePath &&
      (imagePath.startsWith('/uploads/') ||
        imagePath.startsWith('http') ||
        imagePath.startsWith('data:') ||
        /\.(jpg|jpeg|png|webp|svg)$/i.test(imagePath))
    ) {
      return [imagePath];
    }

    // 3. Fallback to default catalog mapping
    const productFormats: Record<number, { [key: string]: string; slide3NoHyphen?: boolean }> = {
      1: { home: '.jpeg', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
      2: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.jpg' },
      3: { home: '.webp', slide1: '.webp', slide2: '.jpg', slide3: '.jpg' },
      4: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
      5: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
      6: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
      7: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
      8: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
      9: { home: '.webp', slide1: '.webp', slide2: '.webp', slide3: '.webp' },
      10: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
      11: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
      12: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
      13: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
      14: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
      15: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
      16: { home: '.jpeg', slide1: '.png', slide2: '.jpeg', slide3: '.jpeg' },
      17: { home: '.png', slide1: '.png', slide2: '.png', slide3: '.png' },
      18: { home: '.jpg', slide1: '.jpg', slide2: '.jpg', slide3: '.jpg' },
      19: { home: '.jpeg', slide1: '.png', slide2: '.jpeg', slide3: '.jpeg', slide3NoHyphen: true },
      20: { home: '.png', slide1: '.png', slide2: '.png', slide3: '.png' },
    };
    
    const productFormat = productFormats[productId] || {
      home: '.webp',
      slide1: '.webp',
      slide2: '.webp',
      slide3: '.webp',
    };
    
    const homeProductPath = `${imagePath}/HomeProduct${productFormat.home}`;
    const slide3Path = productFormat.slide3NoHyphen
      ? `${imagePath}/Slide3${productFormat.slide3}`
      : `${imagePath}/Slide-3${productFormat.slide3}`;
    
    return [
      homeProductPath,
      `${imagePath}/Slide-1${productFormat.slide1}`,
      `${imagePath}/Slide-2${productFormat.slide2}`,
      slide3Path,
    ];
  };
  
  const productImages = getProductImageSlides(product.id, product.imagePath, product.images);

  const hasDiscount = product.mrp && product.mrp > product.price;
  const discountAmount = hasDiscount ? product.mrp! - product.price : 0;
  const discountPercent = hasDiscount
    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
    : 0;
  
  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
      {/* Breadcrumb Navigation */}
      <div className="mb-4">
        <nav className="flex text-xs sm:text-sm">
          <ol className="inline-flex items-center space-x-1 md:space-x-2 text-gray-500">
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
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                {product.brand || 'StepStyle'}
              </span>
              <span className="inline-block rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {product.category}
              </span>
              {product.inStock ? (
                <span className="inline-block rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  In Stock
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
            <div className="mt-3 flex items-baseline flex-wrap gap-3">
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
