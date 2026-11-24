import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  getFullOrderByNumber,
  getOrdersForCustomer,
  placeOrderTransactional,
  updateOrderStatusTransactional,
  FullOrderView,
} from '@/lib/db/store';

export const dynamic = 'force-dynamic';

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '******';
  return `******${digits.slice(-4)}`;
}

function maskAddress(address: string, pincode: string): string {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return `Delivery to Pincode ${pincode}`;
  }
  return `•••, ${parts.slice(-2).join(', ')} (${pincode})`;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

function serializeCustomerOrder(view: FullOrderView, isVerifiedOwner: boolean) {
  const { order, items, statusHistory, payment, shipping, returns, refunds, notifications } = view;
  return {
    orderId: order.orderNumber,
    orderNumber: order.orderNumber,
    date: order.createdAt,
    updatedAt: order.updatedAt,
    status: order.status,
    totalAmount: order.totalAmount,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    transactionId: isVerifiedOwner ? payment?.transactionId : undefined,
    utrNumber: isVerifiedOwner ? payment?.utrNumber : undefined,
    estimatedDelivery: shipping?.estimatedDelivery || order.estimatedDelivery,
    carrier: shipping?.carrier || 'BlueDart Express',
    trackingNumber: shipping?.trackingNumber,
    shippedAt: shipping?.shippedAt,
    deliveredAt: shipping?.deliveredAt,
    cancelReason: order.cancelReason,
    piiMasked: !isVerifiedOwner,
    customer: {
      name: isVerifiedOwner ? order.customerName : `${order.customerName.split(' ')[0]} ***`,
      phone: isVerifiedOwner ? order.customerPhone : maskPhone(order.customerPhone),
      email: isVerifiedOwner ? order.customerEmail : maskEmail(order.customerEmail),
      address: isVerifiedOwner
        ? order.deliveryAddress
        : maskAddress(order.deliveryAddress, order.pincode),
      pincode: order.pincode,
    },
    items: items.map((i) => ({
      id: i.productId,
      sku: i.sku,
      name: i.name,
      price: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
      selectedColor: i.selectedColor,
      selectedSize: i.selectedSize,
      imagePath: i.imagePath,
      brand: i.brand,
      category: i.category,
    })),
    statusHistory: statusHistory.map((h) => ({
      id: h.id,
      status: h.status,
      previousStatus: h.previousStatus,
      note: h.note,
      timestamp: h.timestamp,
      updatedByRole: h.updatedByRole,
    })),
    returns: returns.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      requestedAt: r.requestedAt,
      resolvedAt: r.resolvedAt,
    })),
    refunds: refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      referenceId: r.referenceId,
      initiatedAt: r.initiatedAt,
      completedAt: r.completedAt,
    })),
    notifications: isVerifiedOwner
      ? notifications.map((n) => ({
          id: n.id,
          channel: n.channel,
          status: n.status,
          subject: n.subject,
          message: n.message,
          sentAt: n.sentAt,
        }))
      : [],
  };
}

function checkCustomerVerification(view: FullOrderView, verifyToken?: string | null): boolean {
  if (!verifyToken) return false;
  const clean = verifyToken.trim().toLowerCase();
  if (!clean) return false;

  const orderPhoneDigits = view.order.customerPhone.replace(/\D/g, '');
  const cleanDigits = clean.replace(/\D/g, '');
  if (cleanDigits.length >= 4 && orderPhoneDigits.endsWith(cleanDigits.slice(-4))) {
    return true;
  }

  if (view.order.customerEmail && view.order.customerEmail.toLowerCase() === clean) {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const verify = searchParams.get('verify') || searchParams.get('email') || searchParams.get('phone');
    const listEmail = searchParams.get('email');
    const listPhone = searchParams.get('phone');

    if (orderId) {
      const view = await getFullOrderByNumber(orderId);
      if (!view) {
        return NextResponse.json(
          {
            success: false,
            error: `No order found with Order Number "${orderId.trim().toUpperCase()}". Please verify your confirmation receipt and try again.`,
          },
          { status: 404 }
        );
      }

      const isVerified = checkCustomerVerification(view, verify);
      return NextResponse.json({
        success: true,
        order: serializeCustomerOrder(view, isVerified),
      });
    }

    // Only allow listing own orders when explicit signed-in customer identifier matches
    if (listEmail || listPhone) {
      const views = await getOrdersForCustomer(listEmail || undefined, listPhone || undefined);
      return NextResponse.json({
        success: true,
        orders: views.map((v) => serializeCustomerOrder(v, true)),
      });
    }

    return NextResponse.json(
      { success: false, error: 'An Order ID is required to track shipment status.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve order tracking details.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot place an order with an empty cart.' },
        { status: 400 }
      );
    }

    for (const item of body.items) {
      const id = Number(item?.id);
      const qty = Number(item?.quantity);
      const price = Number(item?.price);
      if (isNaN(id) || id <= 0 || isNaN(qty) || qty < 1 || isNaN(price) || price < 0) {
        return NextResponse.json(
          { success: false, error: 'Order contains invalid product details or quantity.' },
          { status: 400 }
        );
      }
    }

    const totalAmount = Number(body.totalAmount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Order total amount must be greater than zero.' },
        { status: 400 }
      );
    }

    const { orderView, duplicate } = await placeOrderTransactional({
      orderId: body.orderId ? String(body.orderId) : undefined,
      date: body.date ? String(body.date) : undefined,
      items: body.items,
      totalAmount,
      shippingFee: Number(body.shippingFee) || 0,
      paymentStatus: String(body.paymentStatus || 'Pending'),
      paymentMethod: String(body.paymentMethod || 'Online Payment'),
      transactionId: body.transactionId ? String(body.transactionId) : undefined,
      utrNumber: body.utrNumber ? String(body.utrNumber) : undefined,
      paidToUPI: body.paidToUPI ? String(body.paidToUPI) : undefined,
      customer: {
        name: String(body.customer?.name || 'Customer').trim(),
        phone: String(body.customer?.phone || 'N/A').trim(),
        address: String(body.customer?.address || 'N/A').trim(),
        pincode: String(body.customer?.pincode || 'N/A').trim(),
        email: body.customer?.email ? String(body.customer.email).trim() : undefined,
      },
      estimatedDelivery: body.estimatedDelivery ? String(body.estimatedDelivery) : undefined,
      carrier: body.carrier ? String(body.carrier) : undefined,
      trackingNumber: body.trackingNumber ? String(body.trackingNumber) : undefined,
    });

    revalidatePath('/');
    revalidatePath('/products');
    revalidatePath('/products/[id]', 'page');

    return NextResponse.json(
      {
        success: true,
        duplicate,
        order: serializeCustomerOrder(orderView, true),
      },
      { status: duplicate ? 200 : 201 }
    );
  } catch (error) {
    console.error('Error placing order:', error);
    const rawMsg = error instanceof Error ? error.message : '';
    if (rawMsg.startsWith('INSUFFICIENT_STOCK:')) {
      return NextResponse.json(
        {
          success: false,
          error: rawMsg.replace(/^INSUFFICIENT_STOCK:\s*/, ''),
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to place order.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = String(body.orderId || '');
    const action = String(body.action || '');
    const verify = String(body.verify || '');
    const reason = String(body.reason || 'Customer requested return via Order Tracking');

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required.' },
        { status: 400 }
      );
    }

    const view = await getFullOrderByNumber(orderId);
    if (!view) {
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    // Customers may ONLY request a return on a Delivered order, and must verify ownership
    if (action !== 'request_return') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized status update. Only admins can modify shipping statuses.',
        },
        { status: 403 }
      );
    }

    if (!checkCustomerVerification(view, verify)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please verify your phone last 4 digits or email to request a return.',
        },
        { status: 403 }
      );
    }

    if (view.order.status !== 'Delivered') {
      return NextResponse.json(
        {
          success: false,
          error: 'Returns can only be requested once an order is Delivered.',
        },
        { status: 400 }
      );
    }

    const updated = await updateOrderStatusTransactional({
      orderNumber: view.order.orderNumber,
      status: 'Return Requested',
      adminId: view.order.userId,
      adminName: view.order.customerName,
      adminRole: 'Customer',
      note: reason.slice(0, 300),
    });

    revalidatePath('/');
    revalidatePath('/products');

    return NextResponse.json({
      success: true,
      order: updated ? serializeCustomerOrder(updated, true) : null,
    });
  } catch (error) {
    console.error('Error in customer order update:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request.' },
      { status: 500 }
    );
  }
}
