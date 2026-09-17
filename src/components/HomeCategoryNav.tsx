import Link from 'next/link';
import { ArrowRight, Flame, Compass, Zap, Sparkles } from 'lucide-react';

const CATEGORIES = [
  {
    name: 'Running',
    slug: 'Running',
    tagline: 'Velocity & Kinetic Bounce',
    description: 'Engineered with shock-dissipating EVA foam outsoles.',
    icon: Zap,
    bgGradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    accentColor: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    name: 'Casual',
    slug: 'Casual',
    tagline: 'Everyday Minimalist Comfort',
    description: 'Ultra-soft Aeroknit uppers made for all-day city walks.',
    icon: Compass,
    bgGradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
    accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  },
  {
    name: 'Sports',
    slug: 'Sports',
    tagline: 'Grip, Agility & Court Stability',
    description: 'VibraGrip vulcanized rubber soles for maximum traction.',
    icon: Flame,
    bgGradient: 'from-rose-500/10 via-red-500/5 to-transparent',
    accentColor: 'text-rose-600 bg-rose-50 border-rose-200',
  },
  {
    name: 'Formal',
    slug: 'Formal',
    tagline: 'Refined Executive Polish',
    description: 'Supple leather craftsmanship paired with orthotic insoles.',
    icon: Sparkles,
    bgGradient: 'from-slate-500/10 via-gray-500/5 to-transparent',
    accentColor: 'text-slate-800 bg-slate-100 border-slate-300',
  },
];

export default function HomeCategoryNav() {
  return (
    <section className="py-12 sm:py-16 bg-white border-b border-gray-100">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Curated Collections</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
              Shop by Footwear Arena
            </h2>
          </div>
          <Link
            href="/products"
            className="mt-3 md:mt-0 inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors group"
          >
            <span>Explore All Footwear</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.slug}
                href={`/products?category=${encodeURIComponent(cat.slug)}`}
                className="group relative rounded-2xl border border-gray-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-indigo-300 transition-all duration-300 hover:translate-y-[-2px] flex flex-col justify-between overflow-hidden"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${cat.bgGradient} opacity-60 group-hover:opacity-100 transition-opacity`}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-2xs group-hover:scale-110 transition-transform ${cat.accentColor}`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                      Series
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">
                    {cat.name}
                  </h3>
                  <div className="text-xs font-semibold text-indigo-600 mb-2">
                    {cat.tagline}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="relative z-10 pt-5 mt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  <span>View Models</span>
                  <div className="w-7 h-7 rounded-full bg-gray-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
