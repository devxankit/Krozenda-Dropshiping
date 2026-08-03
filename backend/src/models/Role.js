import mongoose from 'mongoose'

// RBAC engine, step 1: permissions as data. `key` matches config/constants.js
// ROLE.*; `permissions` is the flat list a User's roles resolve to at login
// (see modules/auth/services — not built yet — and lib/jwt.js, which embeds
// the resolved list on the access token). Seed via src/scripts/seedRoles.js.
const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    surface: { type: String, required: true, trim: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true },
)

export const Role = mongoose.models.Role ?? mongoose.model('Role', roleSchema)
