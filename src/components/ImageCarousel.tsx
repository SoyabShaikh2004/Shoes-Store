'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselSlide {
  image: string;
  title: string;
  badge?: string;
  link: string;
  ctaText: string;
}

const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    image: '/images/Slide-1.png',
    title: 'Kinetic Running Series',
    badge: 'New Arrival',
    link: '/products?category=Running',
    ctaText: 'Shop Running',
  },
  {
    image: '/images/Slide-2.png',
    title: 'Urban Casual Collection',
    badge: 'Streetwear',
    link: '/products?category=Casual',
    ctaText: 'Shop Casual',
  },
  {
    image: '/images/Slide-3.png',
    title: 'High-Traction Sports Range',
    badge: 'Performance',
    link: '/products?category=Sports',
    ctaText: 'Shop Sports',
  },
];

interface CarouselProps {
  slides?: CarouselSlide[];
}

export default function ImageCarousel({ slides = DEFAULT_SLIDES }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goToNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, slides.length]);

  const goToPrevious = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, slides.length]);

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning || index === currentIndex) return;
      setIsTransitioning(true);
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 500);
    },
    [isTransitioning, currentIndex]
  );

  // Auto-advance slides every 5 seconds unless paused
  useEffect(() => {
    if (isPaused || isTransitioning) return;
    const interval = setInterval(() => {
      goToNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, isTransitioning]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="relative w-full aspect-[16/10] sm:aspect-[16/9] md:aspect-[21/9] lg:aspect-[1200/480] max-h-[520px] bg-slate-900 overflow-hidden select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides */}
      {slides.map((slide, index) => {
        const isActive = index === currentIndex;
        return (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* The whole banner is clickable directly to the category */}
            <Link
              href={slide.link}
              className="block relative w-full h-full cursor-pointer focus:outline-none"
              aria-label={`${slide.title} - ${slide.ctaText}`}
            >
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1400px"
                className="object-contain md:object-cover object-center"
                quality={95}
              />

              {/* Minimal subtle bottom gradient strictly for corner badge contrast without darkening the shoes */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />

              {/* Compact Floating Corner Pill - Does NOT obstruct the shoes */}
              <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-8 z-20 flex flex-wrap items-center gap-1.5 sm:gap-3 bg-slate-950/85 hover:bg-slate-950/95 backdrop-blur-md border border-white/20 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-xl transition-all duration-200 max-w-[calc(100%-90px)] sm:max-w-none">
                {slide.badge && (
                  <span className="hidden sm:inline-block text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-300/30">
                    {slide.badge}
                  </span>
                )}
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                  {slide.title}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl transition-colors shadow-xs">
                  <span>{slide.ctaText}</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </span>
              </div>
            </Link>
          </div>
        );
      })}

      {/* Floating Side Arrow Controls - Subtle & Elegant */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          goToPrevious();
        }}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 active:scale-95 text-white border border-white/25 backdrop-blur-md transition-all opacity-85 sm:opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          goToNext();
        }}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 active:scale-95 text-white border border-white/25 backdrop-blur-md transition-all opacity-85 sm:opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Slide Dot Indicators (Bottom Right / Center) */}
      <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-8 z-30 flex items-center space-x-2 bg-black/40 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-full">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goToSlide(index)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              index === currentIndex
                ? 'bg-indigo-400 w-6 shadow-xs'
                : 'bg-white/40 hover:bg-white/75 w-2'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
