// Shared by the modal's submit handler: turns the form's string-y state into
// the multipart body the backend parses. Arrays and objects go up JSON-encoded
// because multipart has no notion of either — see parseJsonField on the server.
export function appendAdvancedFields(body, form) {
  if (form.weight) body.append('weight', form.weight)

  const dims = form.dimensions || {}
  // All three or none: the server stores a partial set as null anyway, so
  // sending one is just noise.
  if (dims.lengthCm && dims.breadthCm && dims.heightCm) {
    body.append('dimensions', JSON.stringify(dims))
  }

  if (form.hsnCode?.trim()) body.append('hsnCode', form.hsnCode.trim())
  if (form.gstRate !== '' && form.gstRate !== undefined && form.gstRate !== null) {
    body.append('gstRate', form.gstRate)
  }
  if (form.moq) body.append('moq', form.moq)

  const tiers = (form.priceTiers || [])
    .filter((t) => t.minQty && t.price)
    .map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }))
  if (tiers.length > 0) body.append('priceTiers', JSON.stringify(tiers))

  const variants = (form.variants || [])
    .filter((v) => v.name?.trim())
    .map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name.trim(),
      sku: v.sku || '',
      // Empty means "inherit the parent's price", which is not the same as 0.
      price: v.price === '' ? null : Number(v.price),
      salePrice: v.salePrice === '' ? null : Number(v.salePrice),
      stock: Number(v.stock) || 0,
      isActive: v.isActive !== false,
    }))
  if (variants.length > 0) body.append('variants', JSON.stringify(variants))
}
