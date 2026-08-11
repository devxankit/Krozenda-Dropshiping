// Seller-specific services go here when they diverge from vendor-shared.
// See modules/vendor-shared/services/ for the shared ones.
import { Seller } from '../../../models/index.js'
import { ApiError } from '../../../lib/ApiError.js'

export async function registerSeller(userId, { storeName, businessModel }) {
  const existing = await Seller.findOne({ user: userId })
  if (existing) {
    throw ApiError.badRequest('A seller profile already exists for this account.')
  }
  return Seller.create({ user: userId, storeName, businessModel })
}

export async function getSellerByUser(userId) {
  const seller = await Seller.findOne({ user: userId })
  if (!seller) {
    throw ApiError.notFound('No seller profile found for this account. Register as a seller first.')
  }
  return seller
}

export async function addKycDocuments(userId, documents) {
  const seller = await getSellerByUser(userId)
  seller.kycDocuments.push(...documents)
  await seller.save()
  return seller
}
