# 🚀 Netlify Deployment Fix Guide

Your app isn't loading on Netlify because of missing environment variables and some configuration issues. Here's how to fix it:

## 🔧 Step 1: Add Environment Variables to Netlify

1. **Go to your Netlify dashboard**: https://app.netlify.com/
2. **Select your deployed site** (Pithu-ChatBot)
3. **Go to Site settings** → **Environment variables**
4. **Add these variables (UPDATED FOR SECURITY)**:

```
HF_TOKEN = [YOUR ACTUAL HUGGING FACE TOKEN]
```

⚠️ **CRITICAL SECURITY UPDATE**:
- Use `HF_TOKEN` (NOT `VITE_HF_TOKEN`) to keep the token server-side only
- Do NOT add any external API URL; the function handles huggingface internally
- The app now uses a Netlify serverless function for secure API handling

## 🔄 Step 2: Redeploy Your Site

After adding the environment variables:

1. **Go to Deploys** tab in your Netlify dashboard
2. **Click "Trigger deploy"** → **"Deploy site"**
3. **Wait for the build to complete**

## 🌐 Step 3: Alternative - Deploy from GitHub (Recommended)

If the above doesn't work, try this:

1. **Push your latest changes to GitHub** (we'll do this below)
2. **In Netlify**: Site settings → Build & deploy → Repository
3. **Click "Link to a different repository"**
4. **Select your GitHub repo**: `Ankit-Shekhar/Pithu-ChatBot`
5. **Set build settings**:
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`

## 🐛 Common Issues & Solutions

### Issue 1: "Environment variables not found"
- **Cause**: Variables not set in Netlify
- **Fix**: Follow Step 1 above

### Issue 2: "Page not found" on refresh
- **Cause**: Missing redirects
- **Fix**: Already fixed with `_redirects` file

### Issue 3: White screen/blank page
- **Cause**: JavaScript errors or missing environment variables
- **Fix**: Check browser console for errors after fixing environment variables

## ✅ After Following These Steps

Your app should:
- ✅ Load the UI properly
- ✅ Show the chatbot interface
- ✅ Handle dark mode toggle
- ✅ Work with the AI chat functionality

## 🔍 Debugging Tips

If it still doesn't work:

1. **Check browser console** (F12) for errors
2. **Check Netlify function logs** in your Netlify dashboard
3. **Verify build logs** for any errors during deployment

## 📱 Test Your Deployed App

Once fixed, test these features:
- Chat interface loads ✅
- Dark mode toggle works ✅
- AI responses work ✅
- Responsive design works ✅

---

# Netlify Secrets Scan Fix Guide

If Netlify builds fail due to secrets scanning:

1. Use placeholders in `.env.example` (no real values)
2. Exclude `.env.example` from secrets scan via `SECRETS_SCAN_OMIT_PATHS` in `netlify.toml`
3. Only set `HF_TOKEN` in the Netlify UI; the function handles the Hugging Face endpoint internally

Example env template:
```
HF_TOKEN="<REPLACE_WITH_YOUR_HUGGING_FACE_TOKEN>"
```

netlify.toml snippet:
```
[build.environment]
  SECRETS_SCAN_OMIT_PATHS = "*.md,NETLIFY_*.md,.env.example"
```

**Next Steps**: Push the safety fixes to GitHub and redeploy!
