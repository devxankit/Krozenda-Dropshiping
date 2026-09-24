// CJ names every variant "<full product title> <option> <size>", so four
// colours of one case arrive as four near-identical 60-character names:
//   "Hole-shaped Silicone Phone Storage Case White 16×10×3cm"
//   "Hole-shaped Silicone Phone Storage Case Black 16×10×3cm"
// Words shared by EVERY variant at the start or end say nothing about which
// one is which — drop them and keep what differs ("White", "Black").
//
// Falls back to the names as given if trimming would leave one blank or two
// the same, and leaves a single variant alone (nothing to compare against).
// Same rule as the storefront's display-side copy in ProductDetailScreen.jsx.

/**
 * @param {string[]} names
 * @returns {string[]} one label per name, same order
 */
function shortVariantLabels(names) {
  const trimmedNames = names.map((n) => String(n ?? '').trim());
  if (trimmedNames.length < 2) return trimmedNames;

  const words = trimmedNames.map((n) => n.split(/\s+/));
  const minLen = Math.min(...words.map((w) => w.length));
  const sameAt = (pick) => words.every((w) => pick(w).toLowerCase() === pick(words[0]).toLowerCase());

  let prefix = 0;
  while (prefix < minLen && sameAt((w) => w[prefix])) prefix += 1;
  let suffix = 0;
  while (prefix + suffix < minLen && sameAt((w) => w[w.length - 1 - suffix])) suffix += 1;

  const labels = words.map((w) => w.slice(prefix, w.length - suffix).join(' '));
  const unique = new Set(labels.map((l) => l.toLowerCase()));
  if (labels.some((l) => !l) || unique.size !== labels.length) return trimmedNames;
  return labels;
}

module.exports = { shortVariantLabels };
