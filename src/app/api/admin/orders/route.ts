import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import {
  addAdminNoteTransactional,
  getAllOrdersAdmin,
  getFullOrderByNumber,
  updateOrderStatusTransactional,
} from '@/lib/db/store';
import { ALL_ORDER_STATUSES, OrderStatus } from '@/lib/db/schema';
import { requireAdmin } from '@/lib/server/adminSession';

export const dynamic = 'force-dynamic';

function escapeCsvCell(value: unknown): string {
  let str = String(value ?? '');
  // Prevent CSV formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = searchParams.get('orderNumber');

    if (orderNumber) {
      const view = await getFullOrderByNumber(orderNumber);
      if (!view) {
        return NextResponse.json(
          { success: false, error: 'Order not found.' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, order: view });
    }

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'All';
    const paymentStatus = searchParams.get('paymentStatus') || 'All';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sort = (searchParams.get('sort') || 'newest') as
      | 'newest'
      | 'oldest'
      | 'amountDesc'
      | 'amountAsc';
    const exportType = searchParams.get('export');

    const { orders, overview } = await getAllOrdersAdmin({
      search,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      sort,
    });

    if (exportType === 'csv' || exportType === 'xlsx') {
      const rows = orders.map((v) => ({
        'Order Number': v.order.orderNumber,
        'Order Date': new Date(v.order.createdAt).toLocaleString('en-IN'),
        'Customer Name': v.order.customerName,
        'Phone': v.order.customerPhone,
        'Email': v.order.customerEmail || '',
        'Address': `${v.order.deliveryAddress} (${v.order.pincode})`,
        'Items Count': v.items.reduce((s, i) => s + i.quantity, 0),
        'Products': v.items
          .map((i) => `${i.name} (UK ${i.selectedSize || 'Std'} x${i.quantity})`)
          .join('; '),
        'Total Amount (INR)': v.order.totalAmount,
        'Order Status': v.order.status,
        'Payment Status': v.order.paymentStatus,
        'Payment Method': v.order.paymentMethod,
        'Carrier': v.shipping?.carrier || 'BlueDart Express',
        'Tracking Number': v.shipping?.trackingNumber || '',
      }));

      if (exportType === 'csv') {
        const headers = Object.keys(
          rows[0] || {
            'Order Number': '',
            'Order Date': '',
            'Customer Name': '',
            'Phone': '',
            'Email': '',
            'Address': '',
            'Items Count': '',
            'Products': '',
            'Total Amount (INR)': '',
            'Order Status': '',
            'Payment Status': '',
            'Payment Method': '',
            'Carrier': '',
            'Tracking Number': '',
          }
        );
        const csvLines = [
          headers.map(escapeCsvCell).join(','),
          ...rows.map((r) =>
            headers.map((h) => escapeCsvCell((r as Record<string, unknown>)[h])).join(',')
          ),
        ];
        return new NextResponse(csvLines.join('\n'), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="stepstyle-orders-${Date.now()}.csv"`,
          },
        });
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="stepstyle-orders-${Date.now()}.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      overview,
      orders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load orders';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req, ['Super Admin', 'Order Manager', 'Inventory Admin']);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const orderNumber = String(body.orderNumber || '');
    const status = body.status as OrderStatus;

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'orderNumber is required.' },
        { status: 400 }
      );
    }

    if (!status || !ALL_ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Valid order status is required.' },
        { status: 400 }
      );
    }

    if (status === 'Order Cancelled' && !String(body.cancelReason || body.note || '').trim()) {
      return NextResponse.json(
        { success: false, error: 'Please provide a cancellation reason.' },
        { status: 400 }
      );
    }

    const updated = await updateOrderStatusTransactional({
      orderNumber,
      status,
      adminId: auth.admin.id,
      adminName: auth.admin.name,
      adminRole: auth.admin.role,
      note: body.note ? String(body.note).trim() : undefined,
      cancelReason: body.cancelReason ? String(body.cancelReason).trim() : undefined,
      carrier: body.carrier ? String(body.carrier).trim() : undefined,
      trackingNumber: body.trackingNumber ? String(body.trackingNumber).trim() : undefined,
      estimatedDelivery: body.estimatedDelivery
        ? String(body.estimatedDelivery).trim()
        : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Order ${updated.order.orderNumber} updated to "${status}"`,
      order: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const orderNumber = String(body.orderNumber || '');
    const note = String(body.note || '').trim();

    if (!orderNumber || !note) {
      return NextResponse.json(
        { success: false, error: 'orderNumber and note are required.' },
        { status: 400 }
      );
    }

    const added = await addAdminNoteTransactional({
      orderNumber,
      adminId: auth.admin.id,
      adminName: auth.admin.name,
      note,
    });

    if (!added) {
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, note: added }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add note';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
