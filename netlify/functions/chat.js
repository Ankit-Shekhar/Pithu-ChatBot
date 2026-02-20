import { InferenceClient } from '@huggingface/inference';

// CORS headers should stay consistent for Netlify
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const hfToken = process.env.HF_TOKEN;
const client = hfToken ? new InferenceClient(hfToken) : null;

const createErrorResponse = (status, message, details) => ({
  statusCode: status,
  headers,
  body: JSON.stringify({ error: message, details }),
});

const extractMessageText = (message) => {
  if (!message) return '';
  if (typeof message === 'string') return message;
  const content = message.content ?? message.text ?? '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        return part?.text ?? '';
      })
      .join('');
  }
  return '';
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return createErrorResponse(405, 'Method not allowed');
  }

  if (!client || !hfToken) {
    console.error('Missing Hugging Face token');
    return createErrorResponse(500, 'Server is not configured with the Hugging Face token');
  }

  try {
    const { question } = JSON.parse(event.body || '{}');

    if (!question || typeof question !== 'string') {
      return createErrorResponse(400, 'Question is required and must be a string');
    }

    const completion = await client.chatCompletion({
      model: 'openai/gpt-oss-20b:groq',
      messages: [{ role: 'user', content: question }],
    });

    const responseText = extractMessageText(completion?.choices?.[0]?.message);

    if (!responseText) {
      console.error('Empty response from Hugging Face:', completion);
      return createErrorResponse(502, 'AI service returned empty content');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, response: responseText }),
    };
  } catch (error) {
    console.error('Hugging Face function error:', error?.message ?? error);
    const status = error?.response?.status ?? error?.status ?? 500;
    let errorMessage = 'AI service error';

    if (status === 400) {
      errorMessage = 'Invalid request format';
    } else if (status === 403) {
      errorMessage = 'API authentication failed';
    } else if (status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (status >= 500) {
      errorMessage = 'API service temporarily unavailable';
    }

    const upstreamMessage =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      (typeof error?.response?.data === 'string' ? error?.response?.data : undefined);

    return createErrorResponse(status, errorMessage, upstreamMessage);
  }
};
