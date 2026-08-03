// Contract every payment provider must satisfy. Project context §12:
// "Integration providers sit behind interfaces — payment, logistics,
// notification, supplier adapter." Razorpay is the only provider in scope
// (§4.1) and Route is mandatory for vendor split settlement — but nothing
// in modules/ should import the Razorpay SDK directly; it should depend on
// this shape so swapping/mocking the provider never touches business code.
export class PaymentProvider {
  /** Create a payment order for a parent Order total. */
  async createOrder(_orderTotal, _currency) {
    throw new Error('Not implemented')
  }

  /** Verify a payment webhook/callback signature. */
  async verifyPayment(_payload, _signature) {
    throw new Error('Not implemented')
  }

  /** Onboard a vendor as a Route linked account (§4.1, §10). */
  async createLinkedAccount(_vendorKycDetails) {
    throw new Error('Not implemented')
  }

  /** Split-transfer a sub-order's vendor share to its linked account. */
  async createTransfer(_subOrderId, _linkedAccountId, _amount) {
    throw new Error('Not implemented')
  }

  /** Full or partial refund, with transfer reversal for the vendor share. */
  async refund(_paymentRef, _amount) {
    throw new Error('Not implemented')
  }
}
