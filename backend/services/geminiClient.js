// ---------------------------------------------------------------------------
// Thin REST wrapper around the Gemini generateContent endpoint.
//
// This is the only module in the project that reads GEMINI_API_KEY, and it
// runs on the server exclusively. The key is passed as an `x-goog-api-key`
// header rather than a query string so it never lands in an access log, a
// proxy log or an error URL.
//
// Deliberately dependency-free: Node 18+ ships global fetch/AbortController,
// so the official SDK would add a transitive tree for one HTTP POST.
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Fast, cheap, and supports function calling — the right trade-off for short
// customer-support turns. Overridable so the model can be moved without a
// code change.
//
// gemini-2.0-flash was retired (the API 404s with a migration notice). Of the
// current flash models, 3.7 measured both fastest and most consistent on this
// project's own function-calling payload (~1.6-2.1s per call across repeated
// runs, vs 3.6 spiking to 10s and 3.8 to 4.7s). That consistency is what
// matters here: one customer turn is TWO calls — the tool round plus the
// answer — so a model's worst case, not its average, is what has to fit inside
// REQUEST_TIMEOUT_MS below.
//
// Deliberately pinned rather than using the floating `gemini-flash-latest`
// alias, so the model cannot change under a running deployment.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

// A customer is staring at a "thinking" indicator while this runs, so the
// ceiling is deliberately low. Express has no default request timeout, and
// without this an upstream stall would hold the socket open indefinitely.
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 20000;

class GeminiError extends Error {
  constructor(message, { status = 502, code = 'GEMINI_ERROR', retryable = false } = {}) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * One generateContent round trip.
 *
 * @param {object}   params
 * @param {string}   params.systemInstruction  System prompt text.
 * @param {Array}    params.contents           Gemini `contents` array (the turn history).
 * @param {Array}    [params.tools]            Function declarations the model may call.
 * @returns {Promise<object>} The first candidate's `content` ({ role, parts }).
 */
async function generateContent({ systemInstruction, contents, tools }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Configuration fault, not a customer fault — surfaced as 503 so it is
    // distinguishable from a bad request in logs and monitoring.
    throw new GeminiError('AI assistant is not configured', {
      status: 503,
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}/${DEFAULT_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        ...(tools?.length ? { tools: [{ functionDeclarations: tools }] } : {}),
        generationConfig: {
          // Support answers are factual restatements of database rows, so
          // near-deterministic sampling is what we want — creative phrasing is
          // exactly the failure mode that produces invented tracking numbers.
          temperature: 0.2,
          maxOutputTokens: 800,
        },
        // Order status and payment wording trips "dangerous"/"financial"
        // heuristics on the stricter defaults; these are the documented
        // permissive thresholds, not a disabling of safety.
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new GeminiError('AI assistant timed out', {
        status: 504,
        code: 'GEMINI_TIMEOUT',
        retryable: true,
      });
    }
    throw new GeminiError('AI assistant is unreachable', {
      status: 502,
      code: 'GEMINI_UNREACHABLE',
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // The upstream body can echo prompt fragments and internal identifiers, so
    // it is logged for operators and never propagated to the customer — the
    // controller maps `code` to a generic message.
    const body = await response.text().catch(() => '');
    console.error('Gemini API error:', response.status, body.slice(0, 500));

    throw new GeminiError('AI assistant request failed', {
      status: response.status === 429 ? 429 : 502,
      code: response.status === 429 ? 'GEMINI_RATE_LIMITED' : 'GEMINI_ERROR',
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const payload = await response.json();
  const candidate = payload?.candidates?.[0];

  if (!candidate?.content) {
    // Safety filter, recitation block, or an empty candidate list. Treated as
    // a normal "cannot answer" rather than an exception so the customer gets a
    // reply instead of an error toast.
    const reason = candidate?.finishReason || payload?.promptFeedback?.blockReason || 'EMPTY_RESPONSE';
    return { role: 'model', parts: [], blocked: true, finishReason: reason };
  }

  return candidate.content;
}

module.exports = { generateContent, isConfigured, GeminiError, DEFAULT_MODEL };
