import { Metadata } from 'next';
import Link from 'next/link';
import { getProducts, getCategories } from '@/lib/data';
import ClientImage from '@/components/ClientImage';
import TeamMemberImage from '@/components/TeamMemberImage';
import {
  ShieldCheck,
  Award,
  Sparkles,
  Truck,
  RotateCcw,
  HeartHandshake,
  Footprints,
  Feather,
  Layers,
  Activity,
  Phone,
  Mail,
  ArrowRight,
  CheckCircle2,
  Users,
  Star,
  MessageSquare,
  Store,
  Compass,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About StepStyle | Handcrafted Footwear & Ergonomic Design',
  description:
    'Discover the StepStyle philosophy: uncompromising comfort, precision ergonomic craftsmanship, and direct-to-consumer athletic and casual footwear.',
};

export default async function AboutPage() {
  const categories = await getCategories();
  const products = await getProducts();
  const productCount = products.length;

  const craftsmanshipPillars = [
    {
      icon: Feather,
      title: 'Featherlight Ergonomics',
      description:
        'Engineered with micro-cellular EVA foam outsoles to reduce stride fatigue by up to 35% across all-day wear.',
    },
    {
      icon: Layers,
      title: 'Multi-Zone Aeroknit™ Mesh',
      description:
        'Hydrophobic engineered weave allows dynamic heat dissipation while locking in a supportive, blister-free fit.',
    },
    {
      icon: Activity,
      title: 'Dynamic Arch Kinetic Balance',
      description:
        'Anatomically contoured footbeds distribute plantar pressure evenly from heel strike through toe-off.',
    },
    {
      icon: ShieldCheck,
      title: 'VibraGrip™ High-Traction Rubber',
      description:
        'Laser-siped vulcanized compound delivering steadfast grip across wet asphalt, hardwood, and polished stone.',
    },
  ];

  const brandValues = [
    {
      icon: Award,
      badge: 'Certified Quality',
      title: 'Uncompromising Craftsmanship',
      description:
        'Every silhouette undergoes rigorous abrasion, flex, and torsion testing before joining our curated catalog.',
    },
    {
      icon: HeartHandshake,
      badge: 'Fair Value',
      title: 'Direct-to-Consumer Honesty',
      description:
        'By partnering directly with modern ateliers and eliminating middleman distributors, we deliver runway caliber at honest prices.',
    },
    {
      icon: Compass,
      badge: 'Intentional Design',
      title: 'Form Follows Movement',
      description:
        'Clean, versatile silhouettes thoughtfully designed to transition seamlessly from your morning run to evening gatherings.',
    },
  ];

  const trustGuarantees = [
    {
      icon: Truck,
      title: 'Express 48-Hour Dispatch',
      detail: 'Fast, trackable shipping right to your doorstep with insured transit.',
    },
    {
      icon: RotateCcw,
      title: '30-Day Wear Guarantee',
      detail: 'Take them for a spin. If the fit is anything less than perfect, exchange hassle-free.',
    },
    {
      icon: ShieldCheck,
      title: '100% Verified Authentic',
      detail: 'Authentic manufacturing credentials and serial-verified craftsmanship.',
    },
    {
      icon: Star,
      title: 'White-Glove Support',
      detail: 'Personalized shoe fitting guidance and dedicated post-purchase care.',
    },
  ];

  const teamMembers = [
    {
      name: 'Laxmi Jaiswar',
      role: 'Founder & Chief Executive Officer',
      bio: 'Pioneered StepStyle with the vision that premium athletic ergonomics and high street aesthetics should be universally accessible.',
      image: '/images/Laxmi.png',
      initials: 'LJ',
      highlight: 'Vision & Brand Direction',
    },
    {
      name: 'Samir Shaikh',
      role: 'Head of Footwear Innovation & Design',
      bio: 'Oversees product ergonomics, material sourcing, and silhouette prototyping with an obsessive focus on foot health and longevity.',
      image: '/images/Samir.png',
      initials: 'SS',
      highlight: 'Industrial Design & Soling',
    },
    {
      name: 'Malik Shaikh',
      role: 'Director of Customer Experience',
      bio: 'Championing customer satisfaction, fit consults, and ensuring every order delivers an exceptional unboxing experience.',
      image: '/images/Malik.png',
      initials: 'MS',
      highlight: 'Client Relations & Fit Specialist',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 pt-2 sm:pt-4 pb-20">
      {/* 1. Header Breadcrumbs & Eyebrow */}
      <div className="container mx-auto px-4 max-w-6xl pt-6 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <Link href="/" className="hover:text-indigo-600 transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-indigo-600">About StepStyle</span>
        </div>
      </div>

      {/* 2. Hero Presentation Banner */}
      <section className="container mx-auto px-4 max-w-6xl mb-16">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-200/80 bg-slate-950 text-white">
          <div className="absolute inset-0">
            <ClientImage
              src="/images/Slide-3.png"
              alt="StepStyle Footwear Showcase"
              fill
              className="object-cover object-center opacity-30 mix-blend-luminosity scale-105 transition-transform duration-700 hover:scale-100"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />
          </div>

          <div className="relative z-10 px-6 py-16 sm:px-12 sm:py-24 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Engineered for Movement • Est. 2025</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6">
              Redefining Footwear with Precision, Comfort &amp; Style
            </h1>

            <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-8 max-w-2xl font-normal">
              StepStyle was founded to eliminate the compromise between aesthetic sophistication and all-day biomechanical support. We engineer modern footwear designed to feel weightless from your morning stride to your evening destination.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:translate-y-[-1px] active:scale-[0.98]"
              >
                <span>Explore The Collection</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 text-sm font-semibold px-6 py-3.5 rounded-xl backdrop-blur-md transition-all hover:translate-y-[-1px]"
              >
                <MessageSquare className="w-4 h-4 text-indigo-300" />
                <span>Speak with a Fit Specialist</span>
              </Link>
            </div>
          </div>

          {/* Key Stat Badges Bar */}
          <div className="relative z-10 border-t border-white/10 bg-white/5 backdrop-blur-md grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
            <div className="p-6 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {productCount}+
              </div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                Curated Styles
              </div>
            </div>
            <div className="p-6 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 tracking-tight">
                {categories.length}
              </div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                Specialized Categories
              </div>
            </div>
            <div className="p-6 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                10,000+
              </div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                Happy Strides
              </div>
            </div>
            <div className="p-6 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight flex items-center justify-center gap-1">
                <span>4.9</span>
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              </div>
              <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">
                Average Rating
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Origin Story & Craft Manifesto */}
      <section className="container mx-auto px-4 max-w-6xl mb-20">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
              <Footprints className="w-3.5 h-3.5" />
              <span>Our Founding Story</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-snug">
              Born from a Discontent with Uncomfortable Footwear
            </h2>

            <div className="space-y-4 text-base text-gray-600 leading-relaxed">
              <p>
                In early 2025, our founders observed a frustrating paradox in modern footwear: athletic shoes looked overly industrial, while stylish everyday lifestyle shoes sacrificed cushioning and caused foot fatigue after just a few hours.
              </p>
              <p>
                StepStyle was launched to bridge this gap. We set out to create footwear that respects human foot anatomy—delivering cloud-like responsiveness, featherweight engineering, and clean, contemporary aesthetics that look effortless anywhere.
              </p>
              <p>
                Today, our studio curates athletic, casual, and formal silhouettes crafted from resilient engineered textiles, supple leathers, and dual-density outsoles.
              </p>
            </div>

            {/* Quote Block */}
            <div className="p-5 rounded-2xl bg-indigo-50/70 border-l-4 border-indigo-600 space-y-2">
              <p className="text-sm font-medium italic text-indigo-950">
                &ldquo;We don&apos;t just sell shoes; we design the foundation of your posture, your stride, and your day. When your feet feel free, you can go further.&rdquo;
              </p>
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                — Laxmi Jaiswar, Founder
              </p>
            </div>
          </div>

          {/* Image Composition */}
          <div className="lg:col-span-6">
            <div className="relative rounded-3xl overflow-hidden shadow-xl border border-gray-200 aspect-4/3 bg-gray-100 group">
              <ClientImage
                src="/images/our-story.jpg"
                alt="StepStyle Studio Workshop"
                fill
                className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              {/* Floating Quality Stamp */}
              <div className="absolute bottom-5 left-5 right-5 p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-white/40 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      100% Quality Inspected
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Hand-inspected before dispatch
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Zero Defects
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Shoe Anatomy & Craftsmanship Pillars */}
      <section className="bg-slate-900 text-white py-20 mb-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/80 px-3.5 py-1.5 rounded-full border border-indigo-800/80">
              The Science of Comfort
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-4 mb-3 text-white">
              Anatomy of a StepStyle Silhouette
            </h2>
            <p className="text-sm sm:text-base text-gray-400">
              Every detail is engineered with intention, prioritizing natural kinetics, lightweight durability, and airflow.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {craftsmanshipPillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="bg-slate-800/70 border border-slate-700/80 hover:border-indigo-500/60 p-6 rounded-2xl transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl group"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Our Core Brand Values */}
      <section className="container mx-auto px-4 max-w-6xl mb-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3.5 py-1.5 rounded-full border border-indigo-100">
            Guiding Principles
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mt-4 mb-3">
            What Sets StepStyle Apart
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            Our promise to our community extends far beyond great aesthetics.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {brandValues.map((val, idx) => {
            const Icon = val.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-8 border border-gray-200/80 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                    {val.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{val.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {val.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Curated Category Showcase */}
      <section className="container mx-auto px-4 max-w-6xl mb-20">
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-indigo-800/40">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 bg-indigo-800/50 px-3 py-1 rounded-full border border-indigo-700/60">
                Explore The Range
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                Engineered for Every Arena of Life
              </h2>
              <p className="text-sm sm:text-base text-gray-300 max-w-xl">
                Whether you&apos;re crushing marathon mileage, walking urban streets, or dressing for formal occasions, StepStyle delivers matching support.
              </p>

              <div className="pt-2 flex flex-wrap gap-2.5">
                {categories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/products?category=${encodeURIComponent(cat)}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white transition-colors"
                  >
                    <span>{cat}</span>
                    <ArrowRight className="w-3 h-3 text-indigo-300" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
                <div className="text-xs text-indigo-200 font-medium uppercase tracking-wider">
                  Complete Catalog
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  {productCount} Curated Models
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Regularly updated with seasonal releases
                </div>
              </div>

              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-6 py-4 rounded-2xl shadow-lg transition-all text-center"
              >
                <Store className="w-4 h-4" />
                <span>Browse All Footwear</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Leadership & Executive Team */}
      <section className="container mx-auto px-4 max-w-6xl mb-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
            <Users className="w-3.5 h-3.5" />
            <span>Leadership &amp; Curators</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mt-4 mb-3">
            The Team Behind Every Step
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            Meet the footwear enthusiasts, designers, and customer advocates steering StepStyle forward.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {teamMembers.map((member, idx) => (
            <div
              key={idx}
              className="group bg-white rounded-3xl p-6 border border-gray-200 shadow-xs hover:shadow-xl transition-all duration-300 text-center flex flex-col justify-between"
            >
              <div>
                <TeamMemberImage
                  src={member.image}
                  alt={member.name}
                  initials={member.initials}
                />
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {member.name}
                </h3>
                <p className="text-xs font-semibold text-indigo-600 mb-3">
                  {member.role}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed mb-4">
                  {member.bio}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <span className="inline-block text-[11px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
                  {member.highlight}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Trust Guarantees Grid */}
      <section className="container mx-auto px-4 max-w-6xl mb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {trustGuarantees.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-gray-50 border border-gray-200/80 rounded-2xl p-5 hover:bg-white hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. Contact & Consultation Hub */}
      <section className="container mx-auto px-4 max-w-6xl">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-md p-8 sm:p-12 text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto">
            <MessageSquare className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Have Questions About Sizing or Fit?
            </h2>
            <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-xl mx-auto">
              Our footwear specialists are ready to help you discover your ideal match, answer questions about materials, or track an existing order.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-md mx-auto text-left">
            <a
              href="mailto:soyxbshxikh@gmail.com"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className="text-[11px] font-bold text-gray-500 uppercase">
                  Email Support
                </div>
                <div className="text-xs font-semibold text-gray-900 truncate">
                  soyxbshxikh@gmail.com
                </div>
              </div>
            </a>

            <a
              href="tel:+918767402383"
              className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-500 uppercase">
                  Phone Assistance
                </div>
                <div className="text-xs font-semibold text-gray-900">
                  +91 8767402383
                </div>
              </div>
            </a>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl shadow-xs transition-all active:scale-[0.98]"
            >
              <span>Visit Contact Center</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="https://wa.me/918767402383"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl shadow-xs transition-all active:scale-[0.98]"
            >
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
