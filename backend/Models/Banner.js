const mongoose = require('mongoose');

// One model backs three storefront placements so admins manage them from a
// single Banners screen instead of three near-identical CRUD pages:
//   'hero'  — the big top carousel (needs an image; tag/subtitle drive the
//             floating badge overlay, no icon/theme)
//   'promo' — the two full-bleed highlight cards (icon + theme + subtitle)
//   'strip' — the small "why shop with us" tiles (icon + theme + subtitle)
const PLACEMENTS = ['hero', 'promo', 'strip'];
const ICONS = ['truck', 'currency', 'shield', 'refresh', 'briefcase', 'building', 'sparkles', 'tag'];
const THEMES = ['blue', 'amber', 'emerald', 'purple'];

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    // Product catalog isn't wired up yet, so the dropdown is a static list on
    // the frontend — these two fields just record whatever option was picked.
    // Swap this for a real `product` ObjectId ref once the catalog exists.
    productId: { type: String, default: null, trim: true },
    productName: { type: String, default: '', trim: true },
    image: { type: String, default: null },
    placement: { type: String, enum: PLACEMENTS, default: 'hero' },
    // subtitle/tag are shared by all placements: promo/strip render them as
    // card copy, hero renders them as the floating badge over the image.
    // icon/theme are only used by 'promo' and 'strip' (icon + copy tiles/cards).
    subtitle: { type: String, default: '', trim: true },
    tag: { type: String, default: '', trim: true },
    icon: { type: String, enum: ICONS, default: 'sparkles' },
    theme: { type: String, enum: THEMES, default: 'blue' },
    ctaPath: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bannerSchema.index({ status: 1 });
bannerSchema.index({ placement: 1, status: 1 });

const Banner = mongoose.model('Banner', bannerSchema);
Banner.PLACEMENTS = PLACEMENTS;
Banner.ICONS = ICONS;
Banner.THEMES = THEMES;

module.exports = Banner;
