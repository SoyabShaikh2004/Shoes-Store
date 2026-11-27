import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ClientSyncOrderInput,
  reconcileClientOrdersTransactional,
} from '@/lib/db/store';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function isSameOriginRequest(req: NextRequest): boolean {
  if (req.headers.get('x-requested-with') === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { success: false, error: 'Invalid request origin.' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = (await req.json()) as { orders?: unknown };
    if (!body || !Array.isArray(body.orders)) {
      return NextResponse.json(
        { success: false, error: 'orders array is required.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const candidates: ClientSyncOrderInput[] = [];
    for (const raw of body.orders.slice(0, 25)) {
      if (!raw || typeof raw !== 'object') continue;
      const itemObj = raw as Record<string, unknown>;
      const code = String(itemObj.orderNumber || itemObj.orderId || '').trim().toUpperCase();
      if (!/^STEP-[A-Z0-9-]{4,24}$/.test(code)) continue;

      const rawItems = Array.isArray(itemObj.items) ? itemObj.items : [];
      const validItems = rawItems
        .map((it) => {
          const i = it as Record<string, unknown>;
          const id = Number(i?.id);
          const qty = Number(i?.quantity);
          const price = Number(i?.price);
          if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(price) || price < 0) {
            return null;
          }
          return {
            id,
            name: String(i?.name || 'Footwear Item'),
            price,
            quantity: Math.min(50, Math.floor(qty)),
            selectedColor: i?.selectedColor ? String(i.selectedColor) : undefined,
            selectedSize: i?.selectedSize ? Number(i.selectedSize) : undefined,
            imagePath: i?.imagePath ? String(i.imagePath) : undefined,
            brand: i?.brand ? String(i.brand) : undefined,
            category: i?.category ? String(i.category) : undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const totalAmount = Number(itemObj.totalAmount);
      if (validItems.length === 0 || !Number.isFinite(totalAmount) || totalAmount <= 0) {
        continue;
      }

      const cust = (itemObj.customer && typeof itemObj.customer === 'object'
        ? itemObj.customer
        : {}) as Record<string, unknown>;

      candidates.push({
        orderNumber: code,
        date: itemObj.date ? String(itemObj.date) : undefined,
        updatedAt: itemObj.updatedAt ? String(itemObj.updatedAt) : undefined,
        items: validItems,
        totalAmount,
        shippingFee: Number(itemObj.shippingFee) || 0,
        paymentStatus: itemObj.paymentStatus ? String(itemObj.paymentStatus) : 'Pending',
        paymentMethod: itemObj.paymentMethod ? String(itemObj.paymentMethod) : 'Online Payment',
        transactionId: itemObj.transactionId ? String(itemObj.transactionId) : undefined,
        utrNumber: itemObj.utrNumber ? String(itemObj.utrNumber) : undefined,
        paidToUPI: itemObj.paidToUPI ? String(itemObj.paidToUPI) : undefined,
        customer: {
          name: cust.name ? String(cust.name) : 'Customer',
          phone: cust.phone ? String(cust.phone) : 'N/A',
          address: cust.address ? String(cust.address) : 'N/A',
          pincode: cust.pincode ? String(cust.pincode) : 'N/A',
          email: cust.email ? String(cust.email) : undefined,
        },
        estimatedDelivery: itemObj.estimatedDelivery ? String(itemObj.estimatedDelivery) : undefined,
        carrier: itemObj.carrier ? String(itemObj.carrier) : undefined,
        trackingNumber: itemObj.trackingNumber ? String(itemObj.trackingNumber) : undefined,
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { success: true, importedCount: 0, alreadyPresentCount: 0, importedOrderNumbers: [] },
        { headers: NO_STORE_HEADERS }
      );
    }

    const result = await reconcileClientOrdersTransactional(candidates, {
      allowStatusPreservation: false,
    });

    if (result.importedCount > 0) {
      revalidatePath('/');
      revalidatePath('/products');
    }

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to synchronize storefront orders';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
