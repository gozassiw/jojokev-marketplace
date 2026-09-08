import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/clients'
import { createPaymentOrder, getOrderFee, payWithBankTransfer, extractVirtualAccount, normalizeNigeriaPhone } from '@/lib/transactpay'

/**
 * Issues a virtual account for an order.
 *
 * Safe to call again: if a live, unexpired account already exists it is
 * returned as-is rather than creating a second payment session.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const db = supabaseAdmin()
  const { data: order } = await db
    .from('orders')
    .select('id, order_number, total_kobo, payment_amount_kobo, status, payment_provider_status, buyer_id, address_id, payment_reference, va_account_number, va_bank_name, va_expires_at')
    .eq('id', orderId).single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Not your order' }, { status: 403 })
  if (order.status !== 'awaiting_payment') {
    return NextResponse.json({ error: 'This order is already paid.' }, { status: 400 })
  }

  // reuse a still-valid account
  if (order.va_account_number && order.va_expires_at && new Date(order.va_expires_at) > new Date() && !['Failed', 'Reversed'].includes(String(order.payment_provider_status))) {
    return NextResponse.json({
      accountNumber: order.va_account_number,
      bankName: order.va_bank_name,
      amountKobo: order.payment_amount_kobo ?? order.total_kobo,
      expiresAt: order.va_expires_at,
      reference: order.payment_reference,
    })
  }

  const { data: profile } = await db
    .from('profiles').select('full_name, phone').eq('id', user.id).single()
  const { data: address } = order.address_id
    ? await db.from('addresses').select('full_name, phone').eq('id', order.address_id).eq('user_id', user.id).single()
    : { data: null }
  const customerPhone = normalizeNigeriaPhone(address?.phone || profile?.phone || '')
  if (!/^\+234\d{10}$/.test(customerPhone)) {
    return NextResponse.json({ error: 'Please enter a valid 11-digit Nigerian phone number in your delivery address before paying.' }, { status: 400 })
  }

  // TransactPay may add a customer fee to the amount transferred. Fetch the
  // provider total first so the bank-transfer instructions and webhook check
  // use the same payable amount.
  let paymentAmountKobo = order.total_kobo

  try {
    const feeResponse = await getOrderFee({ amountKobo: order.total_kobo, paymentOption: 'bank-transfer' })
    const feeData = feeResponse?.data ?? feeResponse
    const feeMajor = Number(feeData?.fee ?? feeData?.customerFee ?? 0)
    const totalMajor = Number(feeData?.total ?? feeData?.totalAmount ?? feeData?.totalAmountCharged)
    if (Number.isFinite(totalMajor) && totalMajor > 0) paymentAmountKobo = Math.round(totalMajor * 100)
    else if (Number.isFinite(feeMajor) && feeMajor >= 0) paymentAmountKobo = order.total_kobo + Math.round(feeMajor * 100)
  } catch (feeError) {
    console.error('[checkout] could not fetch TransactPay fee', feeError)
    return NextResponse.json({ error: 'Transactpay could not calculate the exact transfer amount. Please try again.' }, { status: 502 })
  }

  if (!Number.isFinite(paymentAmountKobo) || paymentAmountKobo < order.total_kobo) {
    return NextResponse.json({ error: 'Transactpay returned an invalid payable amount. Please try again.' }, { status: 502 })
  }

  // new reference each attempt — TransactPay rejects reused references
  const reference = `${order.order_number}-${Date.now().toString(36)}`

  try {
    await createPaymentOrder({
      reference,
      amountKobo: order.total_kobo,
      customerEmail: user.email!,
      customerName: address?.full_name || profile?.full_name || 'Customer',
      customerPhone,
    })

    const payRes = await payWithBankTransfer(reference)
    const va = extractVirtualAccount(payRes)
    if (!va) {
      const providerMessage = typeof payRes?.message === 'string' ? payRes.message : 'Transactpay did not return account details.'
      const providerStatus = payRes?.statusCode ? ` (${String(payRes.statusCode)})` : ''
      return NextResponse.json(
        { error: `Transactpay could not generate a virtual account${providerStatus}: ${providerMessage}` }, { status: 502 })
    }

    // TransactPay virtual accounts last 30 minutes
    const expiresAt = va.expiresAt
      ? new Date(va.expiresAt).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString()

    await db.from('orders').update({
      payment_reference: reference,
      payment_amount_kobo: paymentAmountKobo,
      payment_provider_status: 'Pending',
      payment_failure_reason: null,
      va_account_number: va.accountNumber,
      va_bank_name: va.bankName,
      va_expires_at: expiresAt,
    }).eq('id', orderId)

    return NextResponse.json({
      accountNumber: va.accountNumber,
      bankName: va.bankName,
      accountName: va.accountName,
      amountKobo: paymentAmountKobo,
      expiresAt,
      reference,
    })
  } catch (err: any) {
    console.error('[checkout] failed', err)
    const message = err instanceof Error ? err.message : 'Payment service unavailable.'
    return NextResponse.json({ error: `Transactpay request failed: ${message}` }, { status: 502 })
  }
}
