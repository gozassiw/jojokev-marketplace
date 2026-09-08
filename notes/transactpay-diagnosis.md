# TransactPay diagnosis notes

## Official sources

- https://transactpay.readme.io/reference/webhooks-1.md — Webhooks include `Status`, `StatusCode`, nested `Data`, `orderReference`, `totalAmountCharged`, `orderAmount`, `statusId`, `paymentResponseCode`, and `orderPayments`. The bank-transfer success sample uses `statusId: 5`, `status: Successful`, and response code `00`. The webhook documentation says the server should return HTTP 200.
- https://transactpay.readme.io/reference/verify-order-1.md — Status IDs: 1 Initiated, 2 Pending, 3 Awaiting-Confirmation, 4 Failed, 5 Successful, 6 Reversed, 7 Processing. It explicitly says to verify `statusId` and `status` before considering a payment successful.
- https://transactpay.readme.io/docs/payment-link.md — Bank-transfer virtual accounts are temporary; the exact amount must be transferred, and differing amounts are automatically reversed.
- https://transactpay.readme.io/reference/get-order-fee-1.md — The Order Fee endpoint returns the fee and total payable amount; payload includes amount, currency, and paymentoption.

## Exact failed attempt from Supabase

Order `JK-GAYU3BR3`; JOJOKEV order amount was NGN 600 (`total_kobo=60000`); VA `6920956280`; payment reference `JK-GAYU3BR3-mttalaw0`.

Recorded TransactPay webhook payload:

- `data.status`: `Failed`
- `data.statusId`: `4`
- `data.paymentResponseCode`: `04`
- `data.paymentResponseMessage`: `Transaction failed: failed`
- `data.orderAmount`: `600`
- `data.customerFee`: `20`
- `data.totalAmountCharged`: `620`
- nested `orderPayments[0].status`: `Failed`
- nested `orderPayments[0].responseCode`: `04`
- nested `orderPayments[0].orderPaymentInstrument`: `6920956280`

JOJOKEV correctly left this order as `awaiting_payment` after the failed event. The important mismatch is that the payment page displayed NGN 600, while the provider payload represented a total charged amount of NGN 620 because of a NGN 20 customer fee. The next implementation should fetch/store the provider payable total and display/reconcile that amount rather than assuming `orders.total_kobo` is always the bank-transfer amount.
