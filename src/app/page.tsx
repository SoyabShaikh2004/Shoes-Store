import ImageCarousel from '@/components/ImageCarousel';
import { getProducts } from '@/lib/data';
import HomeCategoryNav from '@/components/HomeCategoryNav';
import HomeProductSection from '@/components/HomeProductSection';
import HomeSpotlightDeal from '@/components/HomeSpotlightDeal';
import HomeReviewsSection from '@/components/HomeReviewsSection';
import HomeNewsletterBar from '@/components/HomeNewsletterBar';
import Link from 'next/link';
import ClientImage from '@/components/ClientImage';
import {
  ShieldCheck,
  Feather,
  RotateCcw,
  Truck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Headphones,
} from 'lucide-react';

export default async function Home() {
  const allProducts = await getProducts();
  // Recategorize "Walking" products as "Running" instead of filtering them out
  const recategorizedProducts = allProducts.map((product) =>
    product.category === 'Walking'
      ? { ...product, category: 'Running' }
      : product
  );

  const spotlightProduct = recategorizedProducts.find((p) => p.id === 1) || recategorizedProducts[0];

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Carousel Section */}
      <section className="relative">
        <ImageCarousel />
      </section>

      {/* 2. Perks & Confidence Ribbon */}
      <section className="bg-slate-900 text-white border-y border-slate-800">
        <div className="container mx-auto px-4 max-w-7xl py-5 sm:py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
            {/* Perk 1 */}
            <div className="flex items-center gap-3.5 pt-3 sm:pt-0 lg:px-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  Express 48h Dispatch
                </div>
                <div className="text-[11px] text-gray-400">
                  Free delivery on orders &gt; ₹999
                </div>
              </div>
            </div>

            {/* Perk 2 */}
            <div className="flex items-center gap-3.5 pt-3 sm:pt-0 lg:px-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  30-Day Fit Guarantee
                </div>
                <div className="text-[11px] text-gray-400">
                  Hassle-free size exchange
                </div>
              </div>
            </div>

            {/* Perk 3 */}
            <div className="flex items-center gap-3.5 pt-3 sm:pt-0 lg:px-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  100% Verified Authentic
                </div>
                <div className="text-[11px] text-gray-400">
                  Direct atelier craftsmanship
                </div>
              </div>
            </div>

            {/* Perk 4 */}
            <div className="flex items-center gap-3.5 pt-3 sm:pt-0 lg:px-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  Expert Fit Guidance
                </div>
                <div className="text-[11px] text-gray-400">
                  Call &amp; WhatsApp shoe specialists
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Shop by Category Quick Navigation */}
      <HomeCategoryNav />

      {/* 4. Interactive Curated Product Collection (With Category Tabs) */}
      <HomeProductSection products={recategorizedProducts} />

      {/* 5. Spotlight Silhouette Deal of the Week */}
      <HomeSpotlightDeal product={spotlightProduct} />

      {/* 6. About StepStyle - Craftsmanship & Brand Philosophy Section */}
      <section className="py-16 md:py-24 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Story & Philosophy */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>The StepStyle Philosophy</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-snug">
                Crafted for Movement. Designed for Everyday Elegance.
              </h2>

              <p className="text-base text-gray-600 leading-relaxed">
                StepStyle was founded with a singular conviction: your footwear should never force a compromise between runway aesthetics and anatomical support.
              </p>

              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Each silhouette incorporates multi-zone Aeroknit™ breathability, dual-density EVA cushioning, and kinetic arch alignment to keep you light on your feet through marathon workdays and active weekends.
              </p>

              {/* Quality Keypoints */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-gray-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Featherlight Soling</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-semibold text-gray-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Anti-Blister Aeroknit</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-semibold text-gray-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>100% Genuine Materials</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-semibold text-gray-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>30-Day Fit Guarantee</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white text-sm font-semibold px-6 py-3.5 rounded-xl shadow-md transition-all hover:translate-x-0.5 active:scale-[0.98]"
                >
                  <span>Explore Our Philosophy &amp; Team</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Visual Highlight Card */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border border-gray-200 aspect-4/3 bg-gray-100 group">
                <ClientImage
                  src="/images/our-story.jpg"
                  alt="StepStyle Footwear Craftsmanship"
                  fill
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-white/50 shadow-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      The StepStyle Standard
                    </div>
                    <div className="text-xs text-gray-500">
                      Hand-inspected precision &amp; ergonomic soling
                    </div>
                  </div>
                  <Link
                    href="/about"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>Read Story</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Pillars Banner */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-gray-200">
            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900 leading-tight">48-Hr Dispatch</div>
                <div className="text-[10px] text-gray-500">Fast insured delivery</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900 leading-tight">30-Day Guarantee</div>
                <div className="text-[10px] text-gray-500">Hassle-free exchange</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900 leading-tight">100% Authentic</div>
                <div className="text-[10px] text-gray-500">Original craftsmanship</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-2xs">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Feather className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900 leading-tight">Featherlight Sole</div>
                <div className="text-[10px] text-gray-500">All-day kinetic cushion</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Verified Customer Endorsements & Social Proof */}
      <HomeReviewsSection />

      {/* 8. StepStyle VIP Inner Circle Newsletter */}
      <HomeNewsletterBar />
    </div>
  );
}
