import { Metadata } from 'next';
import Link from 'next/link';
import { getProducts, getCategories } from '@/lib/data';
import ClientImage from '@/components/ClientImage';
import TeamMemberImage from '@/components/TeamMemberImage';
import { ArrowRight, Mail, Phone, MessageSquare } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About StepStyle | Everyday Footwear',
  description:
    'Learn about StepStyle — direct-to-consumer athletic, casual, and formal footwear built for everyday comfort and honest pricing.',
};

const TEAM_MEMBERS = [
  {
    name: 'Laxmi Jaiswar',
    role: 'Founder & CEO',
    bio: 'Leads StepStyle with a focus on everyday comfort, honest pricing, and clean silhouettes.',
    image: '/images/Laxmi.png',
    initials: 'LJ',
  },
  {
    name: 'Samir Shaikh',
    role: 'Head of Design',
    bio: 'Oversees footwear cushioning, breathable materials, and outsole durability.',
    image: '/images/Samir.png',
    initials: 'SS',
  },
  {
    name: 'Malik Shaikh',
    role: 'Customer Experience',
    bio: 'Handles sizing guidance, order care, and smooth post-purchase support.',
    image: '/images/Malik.png',
    initials: 'MS',
  },
] as const;

export default async function AboutPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const productCount = products.length;

  return (
    <div className="bg-white">
      <div className="container mx-auto max-w-6xl px-4 py-8 sm:py-12 lg:py-16 space-y-12 sm:space-y-16">
        {/* 1. Concise Story & Visual Split */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <p className="text-xs font-semibold text-indigo-600 tracking-wide">
              StepStyle · Est. 2025
            </p>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight text-balance">
              Clean footwear built for all-day comfort.
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
              StepStyle started with a simple goal: pair lightweight cushioned soles with clean, versatile designs you can wear from morning errands to evening plans without overpaying.
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-medium text-slate-500 tabular-nums pt-1">
              <span>{productCount}+ Styles</span>
              <span aria-hidden="true">·</span>
              <span>{categories.length} Categories</span>
              <span aria-hidden="true">·</span>
              <span>48h Dispatch</span>
              <span aria-hidden="true">·</span>
              <span>UPI &amp; COD</span>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <span>Shop Footwear</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
              <Link
                href="/contact"
                className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Contact Us
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
              <ClientImage
                src="/images/our-story.jpg"
                alt="StepStyle Footwear Craftsmanship"
                fill
                className="object-cover object-center"
                priority
              />
            </div>
          </div>
        </section>

        {/* 2. Simple Team Grid */}
        <section className="pt-10 sm:pt-12 border-t border-slate-200 space-y-6 sm:space-y-8">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Our Team
            </h2>
            <p className="text-sm text-slate-500">
              The people behind StepStyle design, quality checks, and customer care.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.name}
                className="group rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 text-center"
              >
                <TeamMemberImage
                  src={member.image}
                  alt={member.name}
                  initials={member.initials}
                />
                <h3 className="text-base font-bold text-slate-900">{member.name}</h3>
                <p className="text-xs font-semibold text-indigo-600 mt-0.5 mb-2">
                  {member.role}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Direct Support Strip */}
        <section className="pt-10 sm:pt-12 border-t border-slate-200">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Questions about sizing or an order?
              </h2>
              <p className="text-sm text-slate-600">
                Reach our team directly by email, phone, or WhatsApp.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 shrink-0">
              <a
                href="mailto:soyxbshxikh@gmail.com"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 transition-colors whitespace-nowrap"
              >
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <span>soyxbshxikh@gmail.com</span>
              </a>
              <a
                href="tel:+918767402383"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-800 transition-colors whitespace-nowrap tabular-nums"
              >
                <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                <span>+91 8767402383</span>
              </a>
              <a
                href="https://wa.me/918767402383"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
