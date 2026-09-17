// The one definition of the responsive ladder, shared by the write side
// (Middlewares/uploadMiddleware generates these) and the read side
// (utils/imageHelper builds srcset URLs from them).
//
// Kept in its own module rather than exported from the middleware so the read
// path — which every controller imports — doesn't have to pull in sharp and
// multer just to know what a derivative is called.
const VARIANTS = [
  { suffix: 'thumb', width: 160 }, // avatars, cart lines, order rows
  { suffix: 'card', width: 400 }, // product grid tiles
  { suffix: 'md', width: 800 }, // detail page main image
];

// What the canonical (largest) file is declared as in a srcset. The pipeline
// never writes anything wider than this.
const CANONICAL_WIDTH = 1200;

module.exports = { VARIANTS, CANONICAL_WIDTH };
