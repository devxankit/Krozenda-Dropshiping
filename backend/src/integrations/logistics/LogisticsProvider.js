// Contract every logistics provider must satisfy (project context §12).
// Shiprocket is the only provider in scope (§4.2).
export class LogisticsProvider {
  /** Allocate a courier and generate an AWB for a sub-order shipment. */
  async generateAwb(_subOrderId, _shipmentDetails) {
    throw new Error('Not implemented')
  }

  /** Schedule a pickup at a vendor or platform warehouse address. */
  async schedulePickup(_pickupAddressId, _awb) {
    throw new Error('Not implemented')
  }

  /** Fetch current tracking status for an AWB. */
  async trackShipment(_awb) {
    throw new Error('Not implemented')
  }

  /** RTO handling — §6.3. */
  async initiateRto(_awb, _reason) {
    throw new Error('Not implemented')
  }
}
