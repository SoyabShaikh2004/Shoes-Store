'use client';

import { useState } from 'react';
import { Mail, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';

export default function HomeNewsletterBar() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSubscribed(true);
  };

  return (
    <section className="py-12 sm:py-16 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-5xl relative z-10">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          {/* Left Text */}
          <div className="md:col-span-7 space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>StepStyle VIP Inner Circle</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Unlock ₹500 Off Your First Order
            </h2>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-md">
              Join 25,000+ shoe enthusiasts. Receive exclusive private drops, early access to new colorways, and biomechanical foot health guides.
            </p>
          </div>

          {/* Right Form */}
          <div className="md:col-span-5">
            {subscribed ? (
              <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-emerald-400/40 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-sm font-bold text-white">Welcome to the Club!</div>
                <div className="text-xs text-emerald-200">
                  Your ₹500 welcome promo code has been dispatched to {email}.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-sm font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <span>Claim My ₹500 Voucher</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-[11px] text-gray-400 text-center">
                  Zero spam. Unsubscribe anytime with 1 click.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
