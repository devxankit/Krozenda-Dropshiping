const { isSupportedLanguage } = require('../services/translationService');

// The UI-language endpoint, shared by all three panels.
//
// Buyers, admins/staff and vendors live in three separate collections, and
// each panel authenticates through its own middleware onto a different request
// property — but the endpoint itself is identical in every other respect, and
// triplicating it would mean three places to keep a validation rule in step.
// The collection and where to find the signed-in account are the only things
// that vary, so they are the only things passed in.
//
// Its own endpoint rather than a field on each panel's profile update: the
// switcher fires on a single tap and must not drag a whole profile payload —
// and its validation — along with it. One field write.
function updateLanguageFor(Model, accountId) {
  return async function updateLanguage(req, res) {
    const { language } = req.body;

    if (!isSupportedLanguage(language)) {
      return res.status(400).json({
        success: false,
        code: 'UNSUPPORTED_LANGUAGE',
        message: `Language "${language}" is not supported.`,
      });
    }

    const next = String(language).toLowerCase();
    await Model.updateOne({ _id: accountId(req) }, { $set: { language: next } });

    res.json({ success: true, message: 'Language updated', data: { language: next } });
  };
}

module.exports = { updateLanguageFor };
