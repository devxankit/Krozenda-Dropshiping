// What the admin panel shows next to a customer / seller about the Privacy
// Policy and Terms. Nobody gets in without ticking the agreement, so a missing
// record (an account made before acceptances were stored) still reads as
// "accepted" — the date and version are filled in when we have them.
const POLICIES = [
  { key: 'privacy', slug: 'privacy-policy' },
  { key: 'terms', slug: 'terms' },
];

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function policyStatus(acceptances) {
  const list = Array.isArray(acceptances) ? acceptances : [];
  const out = {};
  for (const { key, slug } of POLICIES) {
    const found = list.find((a) => a.slug === slug);
    out[key] = {
      accepted: true,
      version: found?.version || null,
      acceptedAt: formatDate(found?.acceptedAt),
    };
  }
  return out;
}

module.exports = { policyStatus, formatDate };
