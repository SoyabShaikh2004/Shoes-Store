'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlideItem {
  id?: string;
  image: string;
  alt?: string;
  title?: string;
  link: string;
}

const DEFAULT_SLIDES: HeroSlideItem[] = [
  {
    id: 'slide-1',
    image: '/images/Slide-1.png',
    alt: 'Kinetic Running Series',
    link: '/products?category=Running',
  },
  {
    id: 'slide-2',
    image: '/images/Slide-2.png',
    alt: 'Urban Casual Collection',
    link: '/products?category=Casual',
  },
  {
    id: 'slide-3',
    image: '/images/Slide-3.png',
    alt: 'High-Traction Sports Range',
    link: '/products?category=Sports',
  },
];

interface CarouselProps {
  slides?: HeroSlideItem[];
}

export default function ImageCarousel({ slides }: CarouselProps) {
  const activeSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [failedSlides, setFailedSlides] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(0);
    }
  }, [activeSlides.length, currentIndex]);

  const goToNext = useCallback(() => {
    if (isTransitioning || activeSlides.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    setTimeout(() => setIsTransitioning(false), 450);
  }, [isTransitioning, activeSlides.length]);

  const goToPrevious = useCallback(() => {
    if (isTransitioning || activeSlides.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev === 0 ? activeSlides.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 450);
  }, [isTransitioning, activeSlides.length]);

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
    if (isPaused || isTransitioning || activeSlides.length <= 1) return;
    const interval = setInterval(() => {
      goToNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, isTransitioning, activeSlides.length]);

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
      {/* Tall 4:3 Mobile Hero Showcase -> 16:7 Tablet/Desktop Showcase (Zero Overlaid Text) */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/7] max-h-[460px] bg-slate-100 overflow-hidden rounded-2xl sm:rounded-none border border-slate-200 sm:border-x-0 sm:border-t-0 group">
        {activeSlides.map((slide, index) => {
          const isActive = index === currentIndex;
          const fallbackImg = DEFAULT_SLIDES[index % DEFAULT_SLIDES.length].image;
          const imgSrc = failedSlides[index] ? fallbackImg : slide.image || fallbackImg;
          const label = slide.alt || slide.title || `Featured shoe slide ${index + 1}`;
          const targetHref =
            slide.link && slide.link.startsWith('/') && !slide.link.startsWith('//')
              ? slide.link
              : '/products';

          return (
            <div
              key={slide.id || index}
              className={`absolute inset-0 transition-opacity duration-500 ease-out ${
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <Link
                href={targetHref}
                className="block relative w-full h-full cursor-pointer focus:outline-none"
                aria-label={label}
              >
                <Image
                  src={imgSrc}
                  alt={label}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 1280px"
                  className="object-cover object-center"
                  quality={95}
                  unoptimized={
                    imgSrc.startsWith('http') ||
                    imgSrc.startsWith('/uploads/') ||
                    imgSrc.startsWith('/api/uploads/')
                  }
                  onError={() =>
                    setFailedSlides((prev) => ({
                      ...prev,
                      [index]: true,
                    }))
                  }
                />
              </Link>
            </div>
          );
        })}

        {/* Desktop & Tablet Arrows */}
        {activeSlides.length > 1 && (
          <>
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
          </>
        )}
      </div>

      {/* Minimal Indicator Dots Below */}
      {activeSlides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2.5 pb-1">
          {activeSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Slide ${index + 1}`}
              onClick={() => goToSlide(index)}
              className="px-1.5 py-1.5 cursor-pointer"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-slate-900 w-5'
                    : 'bg-slate-300 hover:bg-slate-400 w-1.5'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
