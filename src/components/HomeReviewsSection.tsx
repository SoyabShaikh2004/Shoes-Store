import { Star, CheckCircle, Quote, ThumbsUp } from 'lucide-react';

const REVIEWS = [
  {
    author: 'Aarav Mehta',
    location: 'Mumbai, MH',
    verified: true,
    rating: 5,
    title: 'Effortless all-day cushioning',
    comment:
      'I log 12,000 steps a day between commutes and office walks. The kinetic soling genuinely absorbs heel impact. No plantar soreness at all after 3 weeks of daily wear.',
    shoeModel: 'Kinetic Strider Pro',
    category: 'Running',
    date: 'March 2026',
  },
  {
    author: 'Priya Sharma',
    location: 'Bengaluru, KA',
    verified: true,
    rating: 5,
    title: 'Breathable, featherlight and sleek',
    comment:
      'The Aeroknit mesh makes a massive difference in warm weather. Feet stay cool, and the silhouette looks sharp with both chinos and running shorts. Unboxing experience was top tier.',
    shoeModel: 'AeroKnit Urban Minimalist',
    category: 'Casual',
    date: 'February 2026',
  },
  {
    author: 'Rohan Deshmukh',
    location: 'Pune, MH',
    verified: true,
    rating: 5,
    title: 'Super fast dispatch & true to size',
    comment:
      'Arrived in 48 hours in pristine condition. Size 9 fits like a glove with zero heel slippage. Grip on polished tile and wet asphalt is remarkably solid.',
    shoeModel: 'VibraGrip Trainer 2.0',
    category: 'Sports',
    date: 'March 2026',
  },
];

export default function HomeReviewsSection() {
  return (
    <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-3">
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Customer Endorsements</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            Trusted by 10,000+ Active Strides
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mt-2">
            Read authentic experiences from runners, commuters, and creators who stepped into StepStyle.
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REVIEWS.map((review, idx) => (
            <div
              key={idx}
              className="bg-gray-50/70 border border-gray-200/80 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:bg-white hover:shadow-lg transition-all duration-300"
            >
              <div>
                {/* Rating & Quote Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center text-amber-400">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <Quote className="w-5 h-5 text-gray-300" />
                </div>

                <h3 className="text-base font-bold text-gray-900 mb-2">
                  &ldquo;{review.title}&rdquo;
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-6">
                  {review.comment}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200/60 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                    <span>{review.author}</span>
                    {review.verified && (
                      <span className="inline-flex items-center text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3 mr-0.5" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {review.location} • {review.date}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full block">
                    {review.shoeModel}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Aggregate Score Bar */}
        <div className="mt-12 p-6 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto text-center sm:text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-xs">
              4.9
            </div>
            <div>
              <div className="text-sm font-bold text-indigo-950">
                Industry-Leading Fit Satisfaction
              </div>
              <div className="text-xs text-indigo-700/80">
                Based on 2,400+ verified owner fit consults &amp; delivery feedbacks
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
            <span className="ml-1 text-xs text-gray-600">(98.4% 5-Star)</span>
          </div>
        </div>
      </div>
    </section>
  );
}
