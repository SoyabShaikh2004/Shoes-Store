'use client';

import Image from 'next/image';
import { useState } from 'react';
import { User } from 'lucide-react';

type TeamMemberImageProps = {
  src: string;
  alt: string;
  initials?: string;
  productFallback?: string;
};

export default function TeamMemberImage({
  src,
  alt,
  initials = 'ST',
  productFallback,
}: TeamMemberImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError && productFallback) {
      setImgSrc(productFallback);
      setHasError(true);
    } else {
      setHasError(true);
    }
  };

  return (
    <div className="relative w-44 h-44 sm:w-48 sm:h-48 mx-auto mb-5 rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl group-hover:scale-[1.02] transition-all duration-300 border-2 border-white ring-1 ring-gray-200/80 bg-gradient-to-br from-slate-100 to-indigo-50/50">
      {!hasError ? (
        <Image
          src={imgSrc}
          alt={alt}
          fill
          sizes="(max-width: 640px) 176px, 192px"
          className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
          onError={handleError}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-slate-900 text-white">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2 backdrop-blur-xs">
            <User className="w-8 h-8 text-indigo-200" />
          </div>
          <span className="text-xl font-bold tracking-wider">{initials}</span>
        </div>
      )}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5 pointer-events-none" />
    </div>
  );
} 