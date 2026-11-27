'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/lib/data';
import ImageUploader from './ImageUploader';
import { toast } from 'react-hot-toast';
import { getAdminAuthHeaders, handleAdminUnauthorized } from '@/lib/adminAuth';
import { resolveProductGallery } from '@/lib/productImages';
import { notifyStorefrontChanged } from '@/lib/storefrontSync';
import {
  Tag,
  DollarSign,
  Layers,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  ArrowLeft,
} from 'lucide-react';

interface ProductFormProps {
  initialProduct?: Product | null;
  categories: string[];
  onSuccess: (product: Product) => void;
  onCancel?: () => void;
}

const COMMON_COLOR_PRESETS = [
  'Black/White',
  'All Black',
  'Triple White',
  'Navy/White',
  'Red/Black',
  'Gray/Silver',
  'Olive/Gum',
  'Volt/Black',
];

const AVAILABLE_SIZES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13];

export default function ProductForm({
  initialProduct,
  categories,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const isEditing = Boolean(initialProduct);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [brand, setBrand] = useState('StepStyle');
  const [category, setCategory] = useState('Running');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | string>(7999);
  const [mrp, setMrp] = useState<number | string>(9999);
  const [stockQuantity, setStockQuantity] = useState<number | string>(25);
  const [gender, setGender] = useState<'Men' | 'Women' | 'Unisex' | 'Kids'>('Men');
  const [shoeType, setShoeType] = useState('Sneakers');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [tagsInput, setTagsInput] = useState('');
  const [inStock, setInStock] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [colors, setColors] = useState<string[]>(['Black/White']);
  const [newColorInput, setNewColorInput] = useState('');
  const [sizes, setSizes] = useState<number[]>([7, 8, 9, 10, 11]);
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate fields if initialProduct is supplied (edit mode)
  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name || '');
      setSku(initialProduct.sku || '');
      setBrand(initialProduct.brand || 'StepStyle');
      setDescription(initialProduct.description || '');
      setPrice(initialProduct.price ?? '');
      setMrp(initialProduct.mrp ?? initialProduct.price ?? '');
      setStockQuantity(initialProduct.stockQuantity ?? (initialProduct.inStock ? 25 : 0));
      setGender(initialProduct.gender || 'Men');
      setShoeType(initialProduct.shoeType || initialProduct.category || 'Sneakers');
      setStatus(initialProduct.status === 'inactive' ? 'inactive' : 'active');
      setTagsInput((initialProduct.tags || []).join(', '));
      setInStock(initialProduct.inStock ?? true);
      setFeatured(initialProduct.featured ?? false);
      setColors(initialProduct.colors || ['Black/White']);
      setSizes(initialProduct.sizes || [7, 8, 9, 10, 11]);

      if (categories.includes(initialProduct.category)) {
        setCategory(initialProduct.category);
        setIsCustomCategory(false);
      } else {
        setCategory('Other');
        setCustomCategory(initialProduct.category);
        setIsCustomCategory(true);
      }

      const resolvedGallery = resolveProductGallery(initialProduct).filter(
        (src) => src !== '/images/Empty-cart.jpg'
      );
      setImages(resolvedGallery);
    } else {
      setName('');
      setSku('');
      setBrand('StepStyle');
      setCategory(categories[0] || 'Running');
      setIsCustomCategory(false);
      setCustomCategory('');
      setDescription('');
      setPrice(6999);
      setMrp(8999);
      setStockQuantity(30);
      setGender('Men');
      setShoeType('Running Shoes');
      setStatus('active');
      setTagsInput('');
      setInStock(true);
      setFeatured(false);
      setColors(['Black/White']);
      setSizes([7, 8, 9, 10, 11]);
      setImages([]);
    }
  }, [initialProduct, categories]);

  // Derived Calculations
  const numPrice = Number(price) || 0;
  const numMrp = Number(mrp) || numPrice;
  const hasDiscount = numMrp > numPrice && numPrice > 0;
  const discountAmount = hasDiscount ? numMrp - numPrice : 0;
  const discountPercent = hasDiscount ? Math.round((discountAmount / numMrp) * 100) : 0;
  const isPriceInvalid = numMrp < numPrice;

  // Color helpers
  const handleAddColor = () => {
    const trimmed = newColorInput.trim();
    if (!trimmed) return;
    if (colors.includes(trimmed)) {
      toast.error('This color already exists');
      return;
    }
    setColors([...colors, trimmed]);
    setNewColorInput('');
  };

  const handleToggleColorPreset = (preset: string) => {
    if (colors.includes(preset)) {
      setColors(colors.filter(c => c !== preset));
    } else {
      setColors([...colors, preset]);
    }
  };

  const handleRemoveColor = (col: string) => {
    setColors(colors.filter(c => c !== col));
  };

  // Size helpers
  const handleToggleSize = (size: number) => {
    if (sizes.includes(size)) {
      setSizes(sizes.filter(s => s !== size));
    } else {
      setSizes([...sizes, size].sort((a, b) => a - b));
    }
  };

  const handleSelectStandardSizes = () => {
    setSizes([7, 8, 9, 10, 11]);
    toast.success('Standard run (7, 8, 9, 10, 11) selected');
  };

  const handleSelectAllSizes = () => {
    setSizes([...AVAILABLE_SIZES]);
    toast.success('All sizes (5-13) selected');
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a shoe name');
      return;
    }

    if (numPrice <= 0) {
      toast.error('Please enter a valid selling price');
      return;
    }

    if (isPriceInvalid) {
      toast.error('MRP cannot be lower than the Selling Price');
      return;
    }

    if (sizes.length === 0) {
      toast.error('Please select at least one shoe size');
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      toast.error('Please specify a category');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(isEditing ? 'Updating shoe...' : 'Adding new shoe to catalog...');

    try {
      const parsedTags = tagsInput
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const qtyNum = Math.max(0, Math.floor(Number(stockQuantity) || 0));

      const payload = {
        name: name.trim(),
        sku: sku.trim() ? sku.trim().toUpperCase() : undefined,
        brand: brand.trim(),
        category: finalCategory,
        description: description.trim(),
        price: numPrice,
        mrp: numMrp,
        stockQuantity: qtyNum,
        inStock: inStock && qtyNum > 0,
        featured,
        status,
        gender,
        shoeType: shoeType.trim() || finalCategory,
        tags: parsedTags.length > 0 ? parsedTags : [finalCategory, brand.trim()],
        colors: colors.length > 0 ? colors : ['Standard'],
        sizes,
        images,
        imagePath: images[0] || '/images/Empty-cart.jpg',
      };

      const url = isEditing
        ? `/api/admin/products/${initialProduct?.id}`
        : '/api/admin/products';

      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        handleAdminUnauthorized(res.status, data?.error);
        throw new Error(data?.error || 'Failed to save product');
      }

      toast.success(
        isEditing ? 'Shoe updated successfully!' : 'New shoe added to storefront!',
        { id: toastId }
      );
      notifyStorefrontChanged('products');
      onSuccess(data.product);
    } catch (err: any) {
      console.error('Error saving product:', err);
      toast.error(err.message || 'Failed to save product', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-4 sm:p-6 lg:p-8 rounded-2xl border border-gray-200 shadow-sm">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-100 gap-4">
        <div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                title="Back to list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isEditing ? `Edit Shoe #${initialProduct?.id}` : 'Create New Shoe Entry'}
            </h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure images, MRP, selling price, sizing, and storefront customization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Shoe' : 'Publish Shoe'}
          </button>
        </div>
      </div>

      {/* SECTION 1: Basic Shoe Details */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-600" />
          General Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Shoe Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Shoe Model Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Air Zoom Pegasus 40, UltraBoost Light"
              className="w-full min-h-[44px] text-base bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Brand */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Brand / Collection
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. StepStyle Elite, Nike, Adidas"
              className="w-full min-h-[44px] text-base sm:text-sm bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Category *
            </label>
            <div className="flex gap-2">
              <select
                value={isCustomCategory ? 'CUSTOM' : category}
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    setIsCustomCategory(true);
                  } else {
                    setIsCustomCategory(false);
                    setCategory(e.target.value);
                  }
                }}
                className="w-full min-h-[44px] text-base sm:text-sm bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="CUSTOM">+ Add Custom Category...</option>
              </select>
            </div>

            {isCustomCategory && (
              <div className="mt-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Type new category name (e.g. Trail, Sneaker)"
                  className="w-full min-h-[44px] text-base sm:text-sm bg-indigo-50/50 border border-indigo-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* SKU */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Unique SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="Auto-generated if left blank (e.g. STEP-RUN-101)"
              className="w-full min-h-[44px] text-base sm:text-sm font-mono bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Stock Quantity *
            </label>
            <input
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => {
                const v = e.target.value;
                setStockQuantity(v);
                if (Number(v) === 0) setInStock(false);
                else if (Number(v) > 0) setInStock(true);
              }}
              className="w-full min-h-[44px] text-base sm:text-sm font-semibold tabular-nums bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as 'Men' | 'Women' | 'Unisex' | 'Kids')}
              className="w-full min-h-[44px] text-base sm:text-sm bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Unisex">Unisex</option>
              <option value="Kids">Kids</option>
            </select>
          </div>

          {/* Shoe Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Shoe Type
            </label>
            <input
              type="text"
              value={shoeType}
              onChange={(e) => setShoeType(e.target.value)}
              placeholder="e.g. Running Shoes, Sneakers, High Tops"
              className="w-full min-h-[44px] text-base sm:text-sm bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status & Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Visibility Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="w-full min-h-[44px] text-base sm:text-sm bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="active">Active (Visible on Storefront)</option>
              <option value="inactive">Inactive (Hidden from Storefront)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Product Tags
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Comma separated: Breathable, Lightweight, Carbon"
              className="w-full min-h-[44px] text-base sm:text-sm bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Product Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of features, materials, cushioning technology, and feel..."
              className="w-full text-base sm:text-sm bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Pricing & MRP Customization */}
      <div className="space-y-4 pt-6 border-t border-gray-100">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          Pricing & MRP Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selling Price */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              Selling Price (₹) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 font-semibold">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="6999"
                className="w-full text-base font-semibold bg-white border border-gray-300 rounded-lg pl-8 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              The actual amount the customer will pay at checkout.
            </p>
          </div>

          {/* Maximum Retail Price (MRP) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
              MRP (Maximum Retail Price ₹) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 font-semibold">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="8999"
                className="w-full text-base font-semibold bg-white border border-gray-300 rounded-lg pl-8 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Strikethrough reference price printed on the box.
            </p>
          </div>

          {/* Real-time Discount & Savings Card */}
          <div className="rounded-xl border p-4 bg-gray-50 flex flex-col justify-center">
            {isPriceInvalid ? (
              <div className="flex items-center gap-2 text-rose-600 text-xs font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Error: MRP must be equal or higher than Selling Price.</span>
              </div>
            ) : hasDiscount ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Customer Discount:</span>
                  <span className="text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {discountPercent}% OFF
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Customer Saves:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    ₹{discountAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-gray-400" />
                Selling at full MRP (No discount badge displayed).
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: Shoe Photo Uploader */}
      <div className="pt-6 border-t border-gray-100">
        <ImageUploader
          images={images}
          onChange={setImages}
          maxImages={8}
        />
      </div>

      {/* SECTION 4: Colorways & Sizing Matrix */}
      <div className="space-y-6 pt-6 border-t border-gray-100">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          Variants & Sizing Run
        </h3>

        {/* Color Variants */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
            Colorways ({colors.length} selected)
          </label>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMON_COLOR_PRESETS.map((preset) => {
              const isSelected = colors.includes(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleToggleColorPreset(preset)}
                  className={`min-h-[36px] text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>

          {/* Active colors list with remove tags */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {colors.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-800 text-xs font-medium pl-2.5 pr-1 py-1 rounded-lg border border-gray-200"
              >
                {c}
                <button
                  type="button"
                  onClick={() => handleRemoveColor(c)}
                  aria-label={`Remove ${c}`}
                  className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded hover:bg-gray-200 hover:text-red-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>

          {/* Add custom color input */}
          <div className="flex flex-col sm:flex-row max-w-sm gap-2">
            <input
              type="text"
              value={newColorInput}
              onChange={(e) => setNewColorInput(e.target.value)}
              placeholder="Add custom color (e.g. Neon Lime)"
              className="flex-1 min-h-[44px] text-base sm:text-xs bg-white border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddColor();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddColor}
              className="min-h-[44px] text-xs font-semibold bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black transition-colors cursor-pointer shrink-0"
            >
              Add Color
            </button>
          </div>
        </div>

        {/* Shoe Size Run */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Available Sizes (UK/US) ({sizes.length} active)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectStandardSizes}
                className="min-h-[36px] px-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                Standard (7-11)
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleSelectAllSizes}
                className="min-h-[36px] px-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                Select All
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SIZES.map((size) => {
              const isSelected = sizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleToggleSize(size)}
                  className={`w-11 h-11 rounded-lg text-sm font-semibold border transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 5: Stock and Storefront Visibility */}
      <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-6">
        {/* In Stock Toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <span className="text-sm font-semibold text-gray-900">In Stock</span>
            <p className="text-xs text-gray-500">
              Shoe is available for purchase and cart checkout.
            </p>
          </div>
        </label>

        {/* Featured Shoe Toggle */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <span className="text-sm font-semibold text-gray-900">Featured Showcase</span>
            <p className="text-xs text-gray-500">
              Highlight with a special badge on storefront and search.
            </p>
          </div>
        </label>
      </div>

      {/* Footer Actions */}
      <div className="pt-6 border-t border-gray-100 flex flex-wrap items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[48px] flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold rounded-lg shadow transition-all disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Shoe' : 'Publish Shoe to Store'}
        </button>
      </div>
    </form>
  );
}
