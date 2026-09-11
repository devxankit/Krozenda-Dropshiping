// Bootstraps the first super admin on boot. Requires Models/User.js lazily
// and no-ops until that model exists, so the server can still start while
// the auth models are being built out.
async function ensureAdmin() {
  let User;
  try {
    User = require('../Models/User');
  } catch (err) {
    console.warn('Skipping admin bootstrap: Models/User.js not implemented yet');
    return;
  }

  const count = await User.countDocuments({ role: 'admin' });
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set: skipping admin bootstrap');
    return;
  }

  if (process.env.ENV === 'production' && password.length < 12) {
    throw new Error('Refusing to boot: ADMIN_PASSWORD is too weak for production');
  }

  await User.create({ email, password, role: 'admin', isActive: true });
  console.log(`Super admin created for ${email}`);
}

module.exports = ensureAdmin;
