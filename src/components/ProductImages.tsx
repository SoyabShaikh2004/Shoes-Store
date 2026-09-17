'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface ProductImagesProps {
  slides: string[];
  productName: string;
}

export default function ProductImages({ slides, productName }: ProductImagesProps) {
  const [currentImages, setCurrentImages] = useState<string[]>(slides);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [activeImage, setActiveImage] = useState<number>(0);
  
  const FALLBACK_IMAGE = '/images/Empty-cart.jpg';

  useEffect(() => {
    // Update images when slides prop changes
    if (slides && slides.length > 0) {
      setCurrentImages(slides);
    } else {
      setCurrentImages([FALLBACK_IMAGE]);
    }
    setFailedImages({});
    setActiveImage(0);
  }, [slides]);

  // Generate fallback paths for a given image path
  const generateFallbackPaths = (imagePath: string): string[] => {
    // If direct uploads or full URL, standard fallback is just the fallback placeholder
    if (
      imagePath.startsWith('/uploads/') ||
      imagePath.startsWith('http') ||
      imagePath.startsWith('data:')
    ) {
      return [FALLBACK_IMAGE];
    }

    // Extract base path and product ID for original catalog items
    const productMatch = imagePath.match(/\/images\/(Product\d+)\/([^.]+)/);
    
    if (!productMatch) return [FALLBACK_IMAGE];
    
    const [, productFolder, imageName] = productMatch;
    const basePath = `/images/${productFolder}/${imageName}`;
    
    // Try all possible extensions for the image
    return [
      `${basePath}.webp`,
      `${basePath}.jpg`, 
      `${basePath}.jpeg`,
      `${basePath}.png`,
      // If it's a slide, try different naming patterns
      imageName.includes('Slide') ? `/images/${productFolder}/HomeProduct.jpg` : null,
      imageName.includes('Slide') ? `/images/${productFolder}/HomeProduct.webp` : null,
      imageName.includes('Slide') ? `/images/${productFolder}/HomeProduct.jpeg` : null,
      imageName.includes('Slide') ? `/images/${productFolder}/HomeProduct.png` : null,
      // Final fallback
      FALLBACK_IMAGE
    ].filter(Boolean) as string[];
  };

  // Try alternative formats if an image fails to load
  const handleImageError = (imageSrc: string, index: number) => {
    setFailedImages(prev => ({ ...prev, [imageSrc]: true }));
    
    const fallbackPaths = generateFallbackPaths(imageSrc);
    const availableFallback = fallbackPaths.find(path => 
      path !== imageSrc && !failedImages[path]
    );
    
    if (availableFallback) {
      const newImages = [...currentImages];
      newImages[index] = availableFallback;
      setCurrentImages(newImages);
    } else {
      const newImages = [...currentImages];
      newImages[index] = FALLBACK_IMAGE;
      setCurrentImages(newImages);
    }
  };

  const activeSrc = currentImages[activeImage] || currentImages[0] || FALLBACK_IMAGE;

  return (
    <div className="flex flex-col-reverse md:flex-row bg-gray-50 rounded-2xl p-3 sm:p-4 md:p-5 border border-gray-200">
      {/* Thumbnail sidebar - horizontal below image on mobile/tablet, vertical on desktop */}
      {currentImages.length > 1 && (
        <div className="flex flex-row md:flex-col gap-2.5 sm:gap-3 p-1 md:mr-4 mt-3 md:mt-0 overflow-x-auto no-scrollbar md:overflow-x-visible md:w-24">
          {currentImages.map((image, index) => (
            <button
              type="button"
              key={`${image}-${index}`} 
              className={`relative flex-shrink-0 h-16 w-16 sm:h-20 sm:w-20 cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                activeImage === index
                  ? 'border-indigo-600 shadow-md ring-2 ring-indigo-200 scale-[1.02]'
                  : 'border-gray-200 hover:border-gray-400 opacity-80 hover:opacity-100'
              }`}
              onMouseEnter={() => setActiveImage(index)}
              onClick={() => setActiveImage(index)}
              aria-label={`View ${productName} image ${index + 1}`}
            >
              <Image
                src={image}
                alt={`${productName} view ${index + 1}`}
                fill
                className="object-contain p-1"
                onError={() => handleImageError(image, index)}
              />
            </button>
          ))}
        </div>
      )}
      
      {/* Main image */}
      <div className="relative flex-1 aspect-square overflow-hidden bg-white rounded-xl border border-gray-100 flex items-center justify-center shadow-inner">
        <Image
          src={activeSrc}
          alt={productName}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-4 transition-all duration-300"
          priority
          onError={() => handleImageError(activeSrc, activeImage)}
        />
      </div>
    </div>
  );
}
