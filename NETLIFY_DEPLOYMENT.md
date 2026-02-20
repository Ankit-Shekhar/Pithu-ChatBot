# Netlify Deployment Guide

## Environment Variables Setup

1. Go to your Netlify dashboard
2. Navigate to: Site settings > Environment variables
3. Add this variable (WITHOUT the VITE_ prefix for security):

```
HF_TOKEN = [YOUR_HUGGING_FACE_INFERENCE_TOKEN]
```

⚠️ **IMPORTANT SECURITY NOTE**: 
- Use `HF_TOKEN` (NOT `VITE_HF_TOKEN`) to keep the token server-side only
- The Netlify function now talks to the Hugging Face Inference API, so no external URL needs to be set
- The app uses a Netlify serverless function to securely handle API calls

## Deployment Steps

1. **Push changes to GitHub:**
   ```bash
   git add .
   git commit -m "Add Netlify configuration and production optimizations"
   git push origin main
   ```

2. **In Netlify Dashboard:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   - Node version: `18`

3. **Trigger new deployment:**
   - Go to Deploys tab and trigger a deploy

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
