const {
  translateBatch,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  SOURCE_LANG,
  MAX_TEXTS_PER_REQUEST,
} = require('../services/translationService');

// GET /translate/languages
// Public: the language switcher renders from this, so the list lives in one
// place instead of being duplicated in the frontend.
function listLanguages(req, res) {
  res.json({ success: true, message: 'Languages fetched', data: { source: SOURCE_LANG, languages: SUPPORTED_LANGUAGES } });
}

// POST /translate
// Body: { to: 'hi', texts: ['Privacy Policy', ...] }
// Returns { translations: { 'Privacy Policy': 'गोपनीयता नीति', ... } } — keyed
// by the source string so the client can look up whatever it happens to render
// without tracking array positions.
async function translateTexts(req, res) {
  const { to, texts } = req.body || {};

  if (!Array.isArray(texts)) {
    return res.status(400).json({ success: false, code: 'INVALID_TEXTS', message: '`texts` must be an array of strings.' });
  }
  if (texts.length > MAX_TEXTS_PER_REQUEST) {
    return res.status(400).json({
      success: false,
      code: 'TOO_MANY_TEXTS',
      message: `Send at most ${MAX_TEXTS_PER_REQUEST} strings per request.`,
    });
  }
  // An unknown language is rejected rather than silently answered in English:
  // a typo'd code in a client should surface as a bug, not as a page that
  // quietly refuses to translate.
  if (!isSupportedLanguage(to)) {
    return res.status(400).json({ success: false, code: 'UNSUPPORTED_LANGUAGE', message: `Language "${to}" is not supported.` });
  }

  const strings = texts.filter((t) => typeof t === 'string');
  const translations = await translateBatch(strings, to);

  res.json({ success: true, message: 'Translated', data: { to: String(to).toLowerCase(), translations } });
}

module.exports = { listLanguages, translateTexts };
