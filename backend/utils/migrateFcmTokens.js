const mongoose = require('mongoose');

// fcmTokens used to be a plain [String]; it is now [{ token, deviceType }].
// Mongoose casts subdocument arrays on hydration, so a single leftover
// string would make every findById on that account throw — this has to run
// before the server takes traffic, not as an offline chore.
//
// Idempotent: the filter only matches documents that still hold a string,
// so on an already-migrated database it is one no-op updateMany per
// collection. Runs through the raw driver to bypass the very casting it is
// there to fix.
//
// Every pre-existing token came from the browser (web push was the only
// client before the apps), so 'web' is the correct backfill.
async function migrateFcmTokens() {
  const collections = ['users', 'customers', 'vendors'];
  let migrated = 0;

  for (const name of collections) {
    const result = await mongoose.connection.collection(name).updateMany(
      { fcmTokens: { $elemMatch: { $type: 'string' } } },
      [
        {
          $set: {
            fcmTokens: {
              $map: {
                input: '$fcmTokens',
                as: 'entry',
                in: {
                  $cond: [
                    { $eq: [{ $type: '$$entry' }, 'string'] },
                    { token: '$$entry', deviceType: 'web' },
                    '$$entry',
                  ],
                },
              },
            },
          },
        },
      ]
    );
    migrated += result.modifiedCount;
  }

  if (migrated) {
    console.log(`Migrated fcmTokens to { token, deviceType } on ${migrated} document(s)`);
  }
}

module.exports = migrateFcmTokens;
