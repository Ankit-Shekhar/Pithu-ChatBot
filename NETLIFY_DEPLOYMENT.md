# Netlify Deployment Guide

## Environment Variables Setup

1. Go to your Netlify dashboard
2. Navigate to: Site settings > Environment variables
3. Add these variables:

```
VITE_GEMINI_API_URL = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
VITE_GEMINI_API_KEY = your_actual_api_key_here
```

## Deployment Steps

1. **Push changes to GitHub:**
   ```bash
   git add .
   git commit -m "Add Netlify configuration and production optimizations"
   git push origin main
   ```

2. **In Netlify Dashboard:**
   - Go to "Site configuration" > "Build & deploy"
   - Build command should be: `npm run build`
   - Publish directory should be: `dist`
   - Node version: `18` (set in Environment variables)

3. **Trigger new deployment:**
   - Go to "Deploys" tab
   - Click "Trigger deploy" > "Deploy site"

## Troubleshooting

If the site still doesn't work:

1. **Check build logs** in Netlify dashboard
2. **Verify environment variables** are set correctly
3. **Check browser console** for errors
4. **Ensure API key is valid** and has proper permissions

## Common Issues:

- **Blank page**: Usually environment variables not set
- **404 errors**: Missing `_redirects` file (now fixed)
- **Build fails**: Check Node version and dependencies
