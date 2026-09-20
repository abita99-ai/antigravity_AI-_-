// ==========================================================================
// Vercel Serverless Function: API Endpoint for Gemini Emotion Analysis
// Path: /api/analyze
// ==========================================================================
import { GoogleGenAI } from '@google/genai';

/**
 * Vercel Serverless Handler
 * @param {import('http').IncomingMessage & { body: any }} req
 * @param {import('http').ServerResponse & { status: (code: number) => any, json: (data: any) => any, setHeader: any, end: any }} res
 */
export default async function handler(req, res) {
  // Set CORS Headers for serverless API
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. POST 요청만 허용됩니다.'
    });
  }

  try {
    // Parse input text from request body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const userText = body?.text || body?.userText || '';

    if (!userText || !userText.trim()) {
      return res.status(400).json({
        success: false,
        error: '일기 내용을 입력해주세요.'
      });
    }

    // Read GEMINI_API_KEY exclusively from Vercel Server Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE' || apiKey.includes('YOUR_GEMINI')) {
      return res.status(500).json({
        success: false,
        error: 'Vercel 서버 환경변수에 GEMINI_API_KEY가 설정되지 않았습니다.'
      });
    }

    // Initialize Google Gen AI SDK on Serverless Function
    const ai = new GoogleGenAI({ apiKey });

    // Psychological counselor prompt format
    const prompt = `너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어(예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 ‘감정: [요약된 감정]\n\n[응원 메시지]’ 와 같이 줄바꿈을 포함해서 보내줘.

사용자의 일기 내용:
${userText.trim()}`;

    // Call latest Gemini Flash model: gemini-2.5-flash
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const rawText = response.text ? response.text.trim() : '';

    // Parse '감정: [요약된 감정]' from Gemini response
    let emotionSummary = '평온';
    const match = rawText.match(/감정:\s*([^\n]+)/);
    if (match && match[1]) {
      emotionSummary = match[1].trim();
    }

    // Return successful response JSON
    return res.status(200).json({
      success: true,
      result: rawText,
      emotionSummary: emotionSummary,
      message: rawText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Vercel Serverless /api/analyze Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'Gemini API 분석 중 서버 오류가 발생했습니다.',
      details: error.message || String(error)
    });
  }
}
