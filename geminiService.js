// ==========================================================================
// Frontend API Client for Vercel Serverless Function (/api/analyze)
// ==========================================================================

/**
 * Send POST request to Vercel Serverless Function /api/analyze with user's diary text
 * @param {string} userText - User's emotion diary input
 * @returns {Promise<Object|null>} Result object containing message, emotionSummary, or null for fallback
 */
export async function analyzeEmotionWithGemini(userText) {
  try {
    // Send POST request to /api/analyze API with user's diary text
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: userText })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.warn('[Vercel Serverless /api/analyze Response Error]:', response.status, errData);
      return null;
    }

    const data = await response.json();

    if (data && data.success && data.message) {
      return {
        rawText: data.message,
        emotionSummary: data.emotionSummary || '평온',
        message: data.message
      };
    }

    return null;
  } catch (err) {
    console.info('[Vercel Serverless API /api/analyze Local Fallback Mode]:', err.message);
    return null;
  }
}
