import axios from 'axios';

export const handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

    // Get environment variables (server-side only, secure)
    const apiUrl = process.env.GEMINI_API_URL;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiUrl || !apiKey) {
      console.error('Missing environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' }),
      };
    }

    // Make the API request to Google Gemini
    const response = await axios({
      url: apiUrl,
      method: 'POST',
      data: {
        contents: [{ parts: [{ text: question }] }],
      },
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
    });

    // Extract the response text
    if (response?.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const responseText = response.data.candidates[0].content.parts[0].text;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          response: responseText,
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

      return {
        statusCode: status,
        headers,
        body: JSON.stringify({ error: errorMessage }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
