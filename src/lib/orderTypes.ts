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

export interface CustomerOrderItem {
  id: number;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal?: number;
  selectedColor?: string;
  selectedSize?: number;
  imagePath?: string;
  brand?: string;
  category?: string;
}

export interface CustomerStatusHistoryEntry {
  id: string;
  status: OrderStatus;
  previousStatus?: OrderStatus;
  note?: string;
  timestamp: string;
  updatedByRole: string;
}

export interface CustomerReturnEntry {
  id: string;
  reason: string;
  status: string;
  requestedAt: string;
  resolvedAt?: string;
}

export interface CustomerRefundEntry {
  id: string;
  amount: number;
  status: string;
  referenceId: string;
  initiatedAt: string;
  completedAt?: string;
}

export interface CustomerNotificationEntry {
  id: string;
  channel: 'website' | 'email' | 'whatsapp';
  status: OrderStatus;
  subject: string;
  message: string;
  sentAt: string;
}

export interface CustomerOrderView {
  orderId: string;
  orderNumber: string;
  date: string;
  updatedAt?: string;
  status: OrderStatus;
  totalAmount: number;
  subtotal?: number;
  shippingFee?: number;
  discountAmount?: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionId?: string;
  utrNumber?: string;
  paidToUPI?: string;
  estimatedDelivery?: string;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelReason?: string;
  piiMasked?: boolean;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    pincode: string;
  };
  items: CustomerOrderItem[];
  statusHistory?: CustomerStatusHistoryEntry[];
  returns?: CustomerReturnEntry[];
  refunds?: CustomerRefundEntry[];
  notifications?: CustomerNotificationEntry[];
  // Legacy fallback field if loaded from older localStorage records
  stage?: string;
}

export function mapLegacyStageToStatus(order: Partial<CustomerOrderView>): OrderStatus {
  if (order.status && (ALL_ORDER_STATUSES as readonly string[]).includes(order.status)) {
    return order.status;
  }
  switch (order.stage) {
    case 'placed':
      return 'Order Placed';
    case 'payment_confirmed':
      return 'Order Confirmed';
    case 'processing':
      return 'Processing';
    case 'packing':
      return 'Packed';
    case 'shipped':
      return 'Shipped';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
    default:
      return order.paymentStatus?.toLowerCase() === 'paid'
        ? 'Order Confirmed'
        : 'Order Placed';
  }
}

export function formatDateTimeIN(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
