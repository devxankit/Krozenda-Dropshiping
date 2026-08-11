// Seller-specific controllers go here when they diverge from vendor-shared.
// See modules/vendor-shared/controllers/ for the shared ones.
import { asyncHandler } from '../../../lib/asyncHandler.js'
import { ApiResponse } from '../../../lib/ApiResponse.js'
import { publicUrlFor } from '../../../middlewares/upload.js'
import { registerSeller as registerSellerRecord, getSellerByUser, addKycDocuments } from '../services/index.js'

function serializeSeller(seller) {
  return {
    id: seller._id.toString(),
    storeName: seller.storeName,
    businessModel: seller.businessModel,
    status: seller.status,
    kycDocuments: seller.kycDocuments.map((doc) => ({
      url: doc.url,
      documentType: doc.documentType,
      uploadedAt: doc.uploadedAt,
    })),
  }
}

export const registerSeller = asyncHandler(async (req, res) => {
  const seller = await registerSellerRecord(req.user.id, req.body)
  new ApiResponse(201, serializeSeller(seller), 'Seller profile created.').send(res)
})

export const getMySellerProfile = asyncHandler(async (req, res) => {
  const seller = await getSellerByUser(req.user.id)
  new ApiResponse(200, serializeSeller(seller)).send(res)
})

// POST /seller/kyc-documents — multipart/form-data, files come through
// middlewares/upload.js's multer instance (see routes.js) as req.files.
export const uploadKycDocuments = asyncHandler(async (req, res) => {
  const files = req.files ?? []
  const documents = files.map((file) => ({
    url: publicUrlFor(req, 'kyc', file.filename),
    documentType: req.body.documentType,
  }))

  const seller = await addKycDocuments(req.user.id, documents)
  new ApiResponse(200, serializeSeller(seller), 'KYC documents uploaded.').send(res)
})
