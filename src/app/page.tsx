import { getProducts } from '@/lib/data';
import HomeMobileShopShell from '@/components/HomeMobileShopShell';
import HomeSpotlightDeal from '@/components/HomeSpotlightDeal';
import HomeReviewsSection from '@/components/HomeReviewsSection';
import HomeNewsletterBar from '@/components/HomeNewsletterBar';
import Link from 'next/link';
import ClientImage from '@/components/ClientImage';
import {
  ShieldCheck,
  RotateCcw,
  Truck,
  ArrowRight,
  CheckCircle2,
  Headphones,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const allProducts = await getProducts();

  // Only expose active, in-stock purchasable shoes on the storefront feed
  const availableProducts = allProducts
    .filter((product) => product.status !== 'inactive' && product.inStock && (product.stockQuantity ?? 1) > 0)
    .map((product) =>
      product.category === 'Walking' ? { ...product, category: 'Running' } : product
    );

  const spotlightProduct =
    availableProducts.find((p) => p.featured) || availableProducts[0];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 1. Mobile-First Instant Search + Compact Hero + Category Tabs + 2-Column Shoe Grid */}
      <HomeMobileShopShell products={availableProducts} />

      {/* 2. Featured Spotlight Shoe with Instant Quick Buy */}
      <HomeSpotlightDeal product={spotlightProduct} />

      {/* 3. Confidence & Brand Craftsmanship Section */}
      <section className="py-12 sm:py-16 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Compact 4-Pillar Trust Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 pb-10 sm:pb-12 border-b border-slate-100">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900">48h Dispatch</div>
                <div className="text-[11px] text-slate-500">Tracked delivery</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900">30-Day Trial</div>
                <div className="text-[11px] text-slate-500">Easy size exchange</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900">UPI &amp; COD</div>
                <div className="text-[11px] text-slate-500">Verified payments</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900">Live Tracking</div>
                <div className="text-[11px] text-slate-500">Real-time status</div>
              </div>
            </div>
          </div>

          {/* Craftsmanship Story Split */}
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-10 sm:pt-14">
            <div className="lg:col-span-6 space-y-5">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                The StepStyle Standard
              </p>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug text-balance">
                Crafted for Movement. Built for Everyday Comfort.
              </h2>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Every StepStyle silhouette pairs breathable Aeroknit uppers, dual-density EVA cushioning, and anatomical arch alignment for marathon workdays and weekend runs.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Featherlight Soling</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Anti-Blister Knit</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Verified Authentic</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>30-Day Fit Guarantee</span>
                </div>
              </div>

              <div className="pt-1 flex flex-wrap gap-3">
                <Link
                  href="/about"
                  className="min-h-[44px] inline-flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <span>Explore Our Craft</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/track-order"
                  className="min-h-[44px] inline-flex items-center gap-2 border border-slate-200 hover:border-slate-300 text-slate-800 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  <span>Track an Order</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100">
                <ClientImage
                  src="/images/our-story.jpg"
                  alt="StepStyle Footwear Craftsmanship"
                  fill
                  className="object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Customer Reviews & Newsletter */}
      <HomeReviewsSection />
      <HomeNewsletterBar />
    </div>
  );
}
