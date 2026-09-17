import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ArrowRight, ShieldCheck, Star, Zap, CheckCircle2 } from 'lucide-react';
import { Product } from '@/lib/data';

interface HomeSpotlightDealProps {
  product?: Product;
}

export default function HomeSpotlightDeal({ product }: HomeSpotlightDealProps) {
  // Use product 1 or default product
  const spotlight = product || {
    id: 1,
    name: 'StepStyle Kinetic Pro-Run Horizon',
    category: 'Running',
    price: 2499,
    mrp: 3499,
    description:
      'Engineered with dual-density kinetic foam and an anatomical heel cradle, the Pro-Run Horizon minimizes plantar stress while returning maximum energy through every phase of your stride.',
  };

  const discountPercent = spotlight.mrp && spotlight.mrp > spotlight.price
    ? Math.round(((spotlight.mrp - spotlight.price) / spotlight.mrp) * 100)
    : 28;

  return (
    <section className="py-14 sm:py-20 bg-slate-950 text-white relative overflow-hidden">
      {/* Background kinetic ambient mesh */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/60 rounded-3xl border border-white/10 p-6 sm:p-10 lg:p-14 shadow-2xl">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Badge */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Spotlight Drop of the Week</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>In Stock • Ready to Ship</span>
                </span>
              </div>

              {/* Title & Reviews */}
              <div>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  {spotlight.name}
                </h2>
                
                <div className="flex items-center gap-3 mt-3 text-xs sm:text-sm text-gray-400">
                  <div className="flex items-center text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="font-bold text-white">4.9 / 5.0</span>
                  <span>(184 Verified Reviews)</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-xl">
                {spotlight.description}
              </p>

              {/* Technical Spec Bullets */}
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-start gap-2.5 text-xs text-gray-300">
                  <Zap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Kinetic Rebound Soling</span>
                    <span className="text-gray-400">Dual-density high-energy return</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-gray-300">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">VibraGrip™ Compound</span>
                    <span className="text-gray-400">Laser-siped anti-slip rubber</span>
                  </div>
                </div>
              </div>

              {/* Pricing & CTA */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    Exclusive Price
                  </div>
                  <div className="flex items-baseline gap-3 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      ₹{spotlight.price.toLocaleString('en-IN')}
                    </span>
                    {spotlight.mrp && (
                      <span className="text-base text-gray-400 line-through">
                        ₹{spotlight.mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      Save {discountPercent}%
                    </span>
                  </div>
                </div>

                <Link
                  href={`/products/${spotlight.id}`}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-indigo-600/40 transition-all hover:translate-y-[-1px] active:scale-[0.98]"
                >
                  <span>Claim Spotlight Deal</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Showcase Image */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full aspect-square max-w-md rounded-2xl overflow-hidden bg-gradient-to-tr from-slate-800 to-indigo-900/40 border border-white/15 p-6 group shadow-2xl">
                <Image
                  src="/images/Product1/HomeProduct.jpeg"
                  alt={spotlight.name}
                  fill
                  className="object-contain p-4 group-hover:scale-110 transition-transform duration-700 ease-out"
                />

                {/* Floating Top Badge */}
                <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-bold text-amber-300">
                  ⚡ Limited Stock
                </div>

                {/* Floating Bottom Quality Stamp */}
                <div className="absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>30-Day Fit Trial</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
