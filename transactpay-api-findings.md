# TransactPay sandbox API findings

Source pages reviewed on 2026-09-05:

- https://transactpay.readme.io/reference/introduction
- https://transactpay.readme.io/reference/authentication-1
- https://transactpay.readme.io/docs/accept-bank-transfers-with-virtual-accounts
- https://transactpay.readme.io/reference/webhooks-1
- https://transactpay.readme.io/reference/create-order-1
- https://transactpay.readme.io/reference/payouts-1

Confirmed facts:

1. Sandbox base URL is `https://payment-api-service.transactpay.ai`.
2. Requests authenticate through the `api-key` header. Public and secret keys are separate; secret keys must remain server-side.
3. Create Order uses `POST /payment/order/create`, with an RSA PKCS#1 v1.5 encrypted JSON payload sent as `{ data: encrypteddata }`.
4. The existing create-order payload shape matches the official example: customer, order, payment.RedirectUrl, and paymentMeta.ipAddress.
5. Bank-transfer flow uses virtual-account payment and the official webhook example reports successful bank transfers with `data.orderReference`, `data.paymentReference`, `data.totalAmountCharged`, `data.orderAmount`, `data.status`, and nested `orderPayments`.
6. Webhooks are configured from the TransactPay dashboard and should receive POST JSON and return HTTP 200 quickly.
7. Official webhook examples use `Successful`/`Success` and `statusCode: 00`; the current handler only checks whether the event string contains `success`, so it may fail to recognize official nested `data.status` payloads.
8. The current webhook handler looks for `data.reference` or `data.orderReference` and only reads `data.amount`; it should also support official fields `orderReference`, `paymentReference`, `totalAmountCharged`, and `orderAmount`.
9. Official payout documentation uses `POST /payout/initiate` with `payoutDetails`, while the current client uses `POST /payout` with a different payload. This requires validation against the user’s sandbox account before changing payout behavior.
10. Webhook signature verification is not documented on the official webhook page reviewed. The current HMAC-SHA512 verification is therefore an unverified assumption and should not be treated as confirmed until TransactPay provides the signing header/secret behavior.

Jojokev webhook URL:
`https://jojokev-marketplace-ng.vercel.app/api/webhooks/transactpay`

## Vercel deployment configuration

Source pages reviewed on 2026-09-05:

- https://vercel.com/docs/rest-api/projects/edit-an-environment-variable
- https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables

Confirmed facts:

1. Existing project environment variables can be updated with `PATCH /v9/projects/{idOrName}/env/{id}`.
2. The request body accepts `key`, `target`, `type`, and `value`.
3. Existing JOJOKEV TransactPay variables have separate production and preview entries. Both should be updated with the new sandbox values so preview and production remain consistent.
4. Secret values must not be printed or committed. The update should be performed using a local payload file and the Vercel bearer token.

## Integration verification results

- The provided sandbox keys successfully created a TransactPay order: HTTP 200, status `success`, status code `01`.
- The provided sandbox keys successfully created a bank-transfer payment option: HTTP 200, status `success`, status code `02`.
- The returned virtual account was present under `data.bankTransferDetails.bankAccount` and the provider returned `Wema Bank` under `data.bankTransferDetails.bankName`.
- The sandbox order-status request returned HTTP 200 with `Pending`, as expected before a simulated transfer.
- The deployed webhook accepted an official-style successful bank-transfer payload with an unknown reference and returned HTTP 200 without settling an order.
- Live public routes `/`, `/how-it-works`, and `/contact` returned HTTP 200; unauthenticated `/checkout` correctly returned HTTP 307 to login.
