import axios from 'axios';

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const buildGeminiUrl = (baseUrl, apiKey) => {
    const url = new URL(baseUrl);
    const existingKey = url.searchParams.get('key');
    if (!existingKey) {
      url.searchParams.set('key', apiKey);
    }
    return url.toString();
  };

  let lastTriedModel;

  try {
    // Parse the request body
    const { question } = JSON.parse(event.body || '{}');

    if (!question || typeof question !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Question is required and must be a string' }),
      };
    }

    // Note: The Generative Language API expects the API key as a query parameter (?key=...)
    // in many environments; header-based keys can yield 403 depending on project restrictions.
    const defaultApiUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const fallbackApiUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const envApiUrl = process.env.GEMINI_API_URL;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY environment variable');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // If a custom model/url is configured, try it first, but still fall back to known-good
    // public models. This helps when a model is not enabled for the project/key yet.
    const apiUrlsToTry = envApiUrl
      ? [envApiUrl, defaultApiUrl, fallbackApiUrl]
      : [defaultApiUrl, fallbackApiUrl];

    let response;
    let usedApiUrl;

    for (const candidateUrl of apiUrlsToTry) {
      usedApiUrl = candidateUrl;
      lastTriedModel = candidateUrl;
      try {
        const finalUrl = buildGeminiUrl(candidateUrl, apiKey);

        response = await axios({
          url: finalUrl,
          method: 'POST',
          data: {
            contents: [{ role: 'user', parts: [{ text: question }] }],
          },
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            // Keep for compatibility; some projects accept header keys too.
            'x-goog-api-key': apiKey,
          },
        });
        break;
      } catch (error) {
        const status = error?.response?.status;
        // If the requested model isn't available to this key/project, Gemini can respond
        // with 403/404. In that case, try the fallback model (if configured).
        const shouldTryNext = (status === 403 || status === 404) && candidateUrl !== apiUrlsToTry[apiUrlsToTry.length - 1];
        if (shouldTryNext) {
          continue;
        }
        throw error;
      }
    }

    // Extract the response text
    if (response?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const responseText = response.data.candidates[0].content.parts[0].text;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          response: responseText,
          model: usedApiUrl,
        }),
      };
    } else {
      console.error('Invalid response structure:', response.data);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Invalid response from AI service' }),
      };
    }
  } catch (error) {
    console.error('Error in Gemini function:', error.message);

    // Handle different types of errors
    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'AI service error';

      if (status === 400) {
        errorMessage = 'Invalid request format';
      } else if (status === 403) {
        errorMessage = 'API authentication failed';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (status >= 500) {
        errorMessage = 'AI service temporarily unavailable';
      }

      const upstreamMessage =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        (typeof error.response?.data === 'string' ? error.response.data : undefined);

      const upstreamData =
        upstreamMessage ||
        (error.response?.data ? JSON.stringify(error.response.data) : undefined);

      return {
        statusCode: status,
        headers,
        body: JSON.stringify({
          error: errorMessage,
          details: upstreamData,
          model: lastTriedModel,
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
