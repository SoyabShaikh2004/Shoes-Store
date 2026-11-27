export const PRIMARY_ORDER_STATUSES = [
  'Order Placed',
  'Order Accepted',
  'Order Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
] as const;

export const ADDITIONAL_ORDER_STATUSES = [
  'Order Cancelled',
  'Payment Failed',
  'Return Requested',
  'Returned',
  'Refund Initiated',
  'Refunded',
] as const;

export const ALL_ORDER_STATUSES = [
  ...PRIMARY_ORDER_STATUSES,
  ...ADDITIONAL_ORDER_STATUSES,
] as const;

export type OrderStatus = (typeof ALL_ORDER_STATUSES)[number];

export type AdminRole =
  | 'Super Admin'
  | 'Catalog Manager'
  | 'Inventory Admin'
  | 'Order Manager';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash?: string;
  passwordSalt?: string;
  loginMethod?: 'password' | 'otp' | 'google';
  defaultAddress?: string;
  defaultPincode?: string;
  createdAt: string;
  lastOrderAt?: string;
  lastLoginAt?: string;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: AdminRole;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
}

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface ProductRecord {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  discountPercentage: number;
  stockQuantity: number;
  categoryId: string;
  category: string;
  brandId: string;
  brand: string;
  imagePath: string;
  images: string[];
  colors: string[];
  sizes: number[];
  tags: string[];
  featured: boolean;
  inStock: boolean;
  status: 'active' | 'inactive';
  gender: 'Men' | 'Women' | 'Unisex' | 'Kids';
  shoeType: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImageRecord {
  id: string;
  productId: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ProductVariantRecord {
  id: string;
  productId: number;
  sku: string;
  size: number;
  color: string;
  stockQuantity: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  pincode: string;
  subtotal: number;
  shippingFee: number;
  discountAmount?: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refund Initiated' | 'Refunded';
  paymentMethod: string;
  stockDeducted: boolean;
  cancelReason?: string;
  estimatedDelivery: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  productId: number;
  sku: string;
  name: string;
  imagePath: string;
  brand: string;
  category: string;
  selectedSize?: number;
  selectedColor?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderStatusHistoryRecord {
  id: string;
  orderId: string;
  status: OrderStatus;
  previousStatus?: OrderStatus;
  note?: string;
  updatedByAdminId?: string;
  updatedByAdminName: string;
  updatedByRole: string;
  timestamp: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  method: string;
  status: 'Pending' | 'Paid' | 'Failed' | 'Refund Initiated' | 'Refunded';
  amount: number;
  transactionId?: string;
  utrNumber?: string;
  paidToUPI?: string;
  paidAt?: string;
  updatedAt: string;
}

export interface ShippingRecord {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  shippedAt?: string;
  deliveredAt?: string;
  updatedAt: string;
}

export interface ReturnRecord {
  id: string;
  orderId: string;
  reason: string;
  status: 'Requested' | 'Approved' | 'Picked Up' | 'Returned' | 'Rejected';
  requestedAt: string;
  resolvedAt?: string;
  handledByAdminName?: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  returnId?: string;
  amount: number;
  method: string;
  status: 'Initiated' | 'Processing' | 'Refunded' | 'Failed';
  referenceId: string;
  initiatedAt: string;
  completedAt?: string;
  handledByAdminName?: string;
}

export interface AdminNoteRecord {
  id: string;
  orderId: string;
  adminId: string;
  adminName: string;
  note: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  channel: 'website' | 'email' | 'whatsapp';
  status: OrderStatus;
  subject: string;
  message: string;
  trackingNumber?: string;
  carrier?: string;
  sentAt: string;
}

export interface AdminNotificationRecord {
  id: string;
  type: 'new_order' | 'return_requested' | 'payment_update' | 'support_message';
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  primaryItemName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  readByAdminName?: string;
}

export interface HeroBannerRecord {
  id: string;
  image: string;
  alt: string;
  link: string;
  updatedAt: string;
}

export interface SupportMessageRecord {
  id: string;
  ticketNumber: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminNote?: string;
  handledByAdminName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  version: number;
  lastPurgedAt?: string;
  users: UserRecord[];
  adminUsers: AdminUserRecord[];
  categories: CategoryRecord[];
  brands: BrandRecord[];
  products: ProductRecord[];
  productImages: ProductImageRecord[];
  productVariants: ProductVariantRecord[];
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  orderStatusHistory: OrderStatusHistoryRecord[];
  payments: PaymentRecord[];
  shipping: ShippingRecord[];
  returns: ReturnRecord[];
  refunds: RefundRecord[];
  adminNotes: AdminNoteRecord[];
  notifications: NotificationRecord[];
  adminNotifications?: AdminNotificationRecord[];
  heroBanners?: HeroBannerRecord[];
  supportMessages?: SupportMessageRecord[];
}
