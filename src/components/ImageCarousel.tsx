'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselSlide {
  image: string;
  title: string;
  link: string;
}

const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    image: '/images/Slide-1.png',
    title: 'Kinetic Running Series',
    link: '/products?category=Running',
  },
  {
    image: '/images/Slide-2.png',
    title: 'Urban Casual Collection',
    link: '/products?category=Casual',
  },
  {
    image: '/images/Slide-3.png',
    title: 'High-Traction Sports Range',
    link: '/products?category=Sports',
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
    setTimeout(() => setIsTransitioning(false), 450);
  }, [isTransitioning, slides.length]);

  const goToPrevious = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 450);
  }, [isTransitioning, slides.length]);

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning || index === currentIndex) return;
      setIsTransitioning(true);
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 450);
    },
    [isTransitioning, currentIndex]
  );

  useEffect(() => {
    if (isPaused || isTransitioning) return;
    const interval = setInterval(() => {
      goToNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, isTransitioning]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goToNext();
      else goToPrevious();
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="w-full bg-white select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pure Shoe Showcase Image Frame (Zero Overlaid Text or Letterboxing) */}
      <div className="relative w-full aspect-[16/7] max-h-[420px] bg-slate-100 overflow-hidden rounded-2xl sm:rounded-none border border-slate-200 sm:border-x-0 sm:border-t-0 group">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <Link
                href={slide.link}
                className="block relative w-full h-full cursor-pointer focus:outline-none"
                aria-label={slide.title}
              >
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 1280px"
                  className="object-cover object-center"
                  quality={95}
                />
              </Link>
            </div>
          );
        })}

        {/* Desktop Navigation Arrows */}
        <button
          type="button"
          onClick={goToPrevious}
          className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 min-w-[44px] min-h-[44px] items-center justify-center rounded-full bg-white/85 hover:bg-white text-slate-900 border border-slate-200 shadow-sm backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={goToNext}
          className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 min-w-[44px] min-h-[44px] items-center justify-center rounded-full bg-white/85 hover:bg-white text-slate-900 border border-slate-200 shadow-sm backdrop-blur-md transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Minimal Slide Dots Below (Zero Text) */}
      <div className="flex items-center justify-center gap-1.5 pt-2.5 pb-1">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Slide ${index + 1}`}
            onClick={() => goToSlide(index)}
            className="px-1 py-1 cursor-pointer"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex ? 'bg-slate-900 w-5' : 'bg-slate-300 hover:bg-slate-400 w-1.5'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
