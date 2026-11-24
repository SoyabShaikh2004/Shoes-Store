import { getProducts } from '@/lib/data';
import { getHeroBannersFromDb } from '@/lib/db/store';
import HomeMobileShopShell from '@/components/HomeMobileShopShell';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [allProducts, heroBanners] = await Promise.all([
    getProducts(),
    getHeroBannersFromDb(),
  ]);

  // Only expose active, in-stock purchasable shoes on the storefront feed
  const availableProducts = allProducts
    .filter((product) => product.status !== 'inactive' && product.inStock && (product.stockQuantity ?? 1) > 0)
    .map((product) =>
      product.category === 'Walking' ? { ...product, category: 'Running' } : product
    );

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Instant Search + Tall 4:3 Hero + Category Tabs + Complete Shoe Grid */}
      <HomeMobileShopShell products={availableProducts} heroBanners={heroBanners} />
    </div>
  );
}
