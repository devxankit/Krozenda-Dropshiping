// Seeds the 13 roles as data (Phase 0 exit criteria — "RBAC engine,
// permissions as data, 13 roles seeded"). Run with `npm run seed:roles`.
//
// Baseline permission mapping below is a starting point, not a finished
// permission matrix — Admin should be able to edit a role's permissions[]
// at runtime once that screen is built; this script only needs to run once
// per environment to bootstrap the collection.
import { connectDb, disconnectDb } from '../config/db.js'
import { ROLE, ROLES } from '../config/constants.js'
import { Role } from '../models/Role.js'
import { logger } from '../lib/logger.js'
import { SELLER_PERMISSIONS } from '../modules/seller/constants.js'
import { DROPSHIPPING_PARTNER_PERMISSIONS } from '../modules/dropshipping-partner/constants.js'
import { ADMIN_PERMISSIONS } from '../modules/admin/constants.js'
import { USER_PERMISSIONS } from '../modules/user/constants.js'

const BASELINE_ROLE_PERMISSIONS = {
  [ROLE.SUPER_ADMIN]: [ADMIN_PERMISSIONS.ACCESS],
  [ROLE.ADMIN]: [ADMIN_PERMISSIONS.ACCESS],
  [ROLE.STAFF]: [ADMIN_PERMISSIONS.ACCESS],
  [ROLE.COMPANY]: [SELLER_PERMISSIONS.ACCESS],
  [ROLE.MANUFACTURER]: [SELLER_PERMISSIONS.ACCESS],
  [ROLE.VENDOR_SELLER]: [SELLER_PERMISSIONS.ACCESS],
  [ROLE.DROPSHIPPING_PARTNER]: [DROPSHIPPING_PARTNER_PERMISSIONS.ACCESS],
  // §2: traders/dealers/distributors/wholesalers can be both seller and buyer.
  [ROLE.TRADER]: [SELLER_PERMISSIONS.ACCESS, USER_PERMISSIONS.ACCESS],
  [ROLE.DEALER]: [SELLER_PERMISSIONS.ACCESS, USER_PERMISSIONS.ACCESS],
  [ROLE.DISTRIBUTOR]: [SELLER_PERMISSIONS.ACCESS, USER_PERMISSIONS.ACCESS],
  [ROLE.WHOLESALER]: [SELLER_PERMISSIONS.ACCESS, USER_PERMISSIONS.ACCESS],
  [ROLE.RETAIL_CUSTOMER]: [USER_PERMISSIONS.ACCESS],
  [ROLE.B2B_BUYER]: [USER_PERMISSIONS.ACCESS],
}

async function seedRoles() {
  await connectDb()

  for (const role of ROLES) {
    await Role.findOneAndUpdate(
      { key: role.key },
      {
        key: role.key,
        label: role.label,
        surface: role.surface,
        permissions: BASELINE_ROLE_PERMISSIONS[role.key] ?? [],
      },
      { upsert: true, new: true },
    )
    logger.info(`[seed:roles] upserted ${role.key}`)
  }

  await disconnectDb()
  logger.info(`[seed:roles] done — ${ROLES.length} roles`)
}

seedRoles().catch((error) => {
  logger.error('[seed:roles] failed', error)
  process.exit(1)
})
