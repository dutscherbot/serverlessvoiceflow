# 🚨 Quick Fix for Voiceflow Connection Error

## The Problem

You're getting: *"Je rencontre actuellement un problème technique de connexion à notre base de données"*

This means the API **cannot connect to MongoDB** when running on Vercel.

## ✅ Quick Fix Steps

### Step 1: Verify Environment Variable Format

**Go to Vercel → Settings → Environment Variables**

Check `MONGO_URI` - the **Value** field should be:

```
mongodb+srv://product_db:Bft4hpqUr01sJaJi@cluster0.shx85qq.mongodb.net/?appName=Cluster0
```

**NOT:**
```
MONGO_URI = mongodb+srv://product_db:...
```

**If it has `MONGO_URI = ` at the start, remove it!**

### Step 2: Verify All Variables

Make sure these 4 variables exist and have correct values:

| Variable | Value |
|----------|-------|
| `MONGO_URI` | `mongodb+srv://product_db:Bft4hpqUr01sJaJi@cluster0.shx85qq.mongodb.net/?appName=Cluster0` |
| `DB_NAME` | `voiceflow_db` |
| `COLLECTION_NAME` | `produits` |
| `SEARCH_INDEX_NAME` | `default` |

**Important:**
- ✅ Values should **NOT** include the variable name
- ✅ Values should **NOT** have quotes
- ✅ All should be set for **Production, Preview, and Development**

### Step 3: Force Redeploy

1. **Vercel Dashboard** → Your Project → **Deployments**
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
4. **Uncheck** "Use existing Build Cache" (if available)
5. Wait for deployment (1-2 minutes)

### Step 4: Test Health Check

After redeploying, test:

```powershell
# Replace with your actual Vercel URL
$url = "https://your-app.vercel.app/api/voiceflow/search"
Invoke-RestMethod -Uri $url -Method GET | ConvertTo-Json
```

**Should return:**
```json
{
  "status": "ok",
  "mongodb": {
    "connected": true,
    "documentCount": 70230
  }
}
```

**If `connected: false`, check Vercel logs for the exact error.**

## 🔍 Check Vercel Logs

1. **Vercel Dashboard** → Your Project
2. **Deployments** → Latest deployment
3. **Logs** tab (or "View Function Logs")
4. Look for errors like:
   - `MONGO_URI is not properly configured`
   - `Failed to connect to MongoDB`
   - `Connection timeout`
   - `Authentication failed`

## 🎯 Most Common Issue

**90% of the time, the issue is:**

The `MONGO_URI` value in Vercel includes `MONGO_URI = ` at the beginning.

**Fix:** Edit the variable and remove `MONGO_URI = ` from the value, keeping only the connection string.

## 📞 Still Not Working?

1. **Share your Vercel URL** - I can test it
2. **Share Vercel logs** - Shows the exact error
3. **Share health check response** - Shows connection status

This will help identify the exact problem!




