'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import Image from 'next/image';
import { Upload, X, Star, Link as LinkIcon, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 6,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast.error(`You can upload a maximum of ${maxImages} images`);
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading('Uploading shoe image(s) to server...');

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      const newUrls = data.urls || [data.url];
      const updated = [...images, ...newUrls];
      onChange(updated);
      toast.success(`Successfully uploaded ${newUrls.length} image(s)!`, { id: toastId });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Image upload failed', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
      toast.error('Please enter a valid URL (starting with http://, https://, or /)');
      return;
    }

    if (images.length >= maxImages) {
      toast.error(`Maximum of ${maxImages} images reached`);
      return;
    }

    onChange([...images, trimmed]);
    setUrlInput('');
    setShowUrlInput(false);
    toast.success('Image URL added!');
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  const handleSetPrimary = (indexToPrimary: number) => {
    if (indexToPrimary === 0) return;
    const item = images[indexToPrimary];
    const rest = images.filter((_, idx) => idx !== indexToPrimary);
    onChange([item, ...rest]);
    toast.success('Main display image updated');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold text-gray-800">
            Shoe Images ({images.length}/{maxImages})
          </label>
          <p className="text-xs text-gray-500">
            First image is the primary storefront cover. Supports PNG, JPG, WEBP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2.5 py-1 rounded-md"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          {showUrlInput ? 'Hide URL input' : 'Add by URL'}
        </button>
      </div>

      {showUrlInput && (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image URL (https://... or /images/...)"
            className="flex-1 text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddUrl}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded-md transition-colors"
          >
            Add Image
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-600 bg-indigo-50/60 scale-[1.01]'
            : 'border-gray-300 hover:border-indigo-400 bg-gray-50/50 hover:bg-indigo-50/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/jpg,image/svg+xml"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading || images.length >= maxImages}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-indigo-700">Uploading shoe images...</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-indigo-600 hover:underline">
                  Click to upload
                </span>{' '}
                or drag & drop shoe photos here
              </div>
              <p className="text-xs text-gray-400">
                PNG, JPG, WEBP or SVG up to 10MB each
              </p>
            </>
          )}
        </div>
      </div>

      {/* Image Gallery Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
          {images.map((imgUrl, index) => {
            const isPrimary = index === 0;
            return (
              <div
                key={`${imgUrl}-${index}`}
                className={`relative group rounded-xl overflow-hidden border bg-white shadow-sm transition-all ${
                  isPrimary ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'
                }`}
              >
                <div className="relative aspect-square w-full bg-gray-50 flex items-center justify-center">
                  <Image
                    src={imgUrl}
                    alt={`Shoe preview ${index + 1}`}
                    fill
                    className="object-contain p-2"
                    unoptimized={imgUrl.startsWith('data:')}
                  />

                  {/* Primary Cover Badge */}
                  {isPrimary && (
                    <div className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      Main Cover
                    </div>
                  )}

                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetPrimary(index);
                        }}
                        title="Set as Main Cover"
                        className="bg-white/90 hover:bg-white text-gray-800 text-xs font-medium px-2 py-1 rounded-md shadow transition-transform active:scale-95 flex items-center gap-1"
                      >
                        <Star className="w-3 h-3 text-amber-500" />
                        Cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      title="Remove image"
                      className="bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-md shadow transition-transform active:scale-95"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
