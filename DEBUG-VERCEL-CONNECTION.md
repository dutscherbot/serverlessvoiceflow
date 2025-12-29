# 🔍 Debug Vercel Connection Issue

Since you're still getting connection errors after updating and redeploying, let's debug step by step.

## Step 1: Test Your Vercel API Directly

First, we need to know your actual Vercel URL. Test it with this command:

```powershell
# Replace with your actual Vercel URL
$url = "https://your-app.vercel.app/api/voiceflow/search"

# Test health check
Invoke-RestMethod -Uri $url -Method GET | ConvertTo-Json -Depth 5
```

**OR use the test script:**
```powershell
# Edit test-vercel-api.ps1 and set your Vercel URL
# Then run:
.\test-vercel-api.ps1
```

## Step 2: Check What Error You're Getting

The error message you're seeing suggests the connection is failing. Let's check:

### A. Check Vercel Logs

1. Go to **Vercel Dashboard** → Your Project
2. Click on **Deployments**
3. Click on the **latest deployment**
4. Click **"View Function Logs"** or **"Logs"** tab
5. Look for MongoDB connection errors

**What to look for:**
- `MONGO_URI is not properly configured`
- `Failed to connect to MongoDB`
- `Connection timeout`
- `Authentication failed`

### B. Test API Response Format

The API should return an error with diagnostic info. Test:

```powershell
$body = @{ query = "test tube" } | ConvertTo-Json
$url = "https://your-app.vercel.app/api/voiceflow/search"

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    }
}
```

## Step 3: Verify Environment Variables Format

**Common Issue:** The value might still have extra text.

### Correct Format:
```
Key: MONGO_URI
Value: mongodb+srv://product_db:Bft4hpqUr01sJaJi@cluster0.shx85qq.mongodb.net/?appName=Cluster0
```

### Wrong Format (what causes errors):
```
Key: MONGO_URI
Value: MONGO_URI = mongodb+srv://product_db:...
```

**Check in Vercel:**
1. Go to **Settings** → **Environment Variables**
2. Click on `MONGO_URI`
3. The **Value** field should contain **ONLY** the connection string
4. It should **NOT** include `MONGO_URI = ` at the beginning

## Step 4: Verify All Variables

Make sure all 4 variables are set correctly:

| Variable | Should Be |
|----------|-----------|
| `MONGO_URI` | `mongodb+srv://product_db:Bft4hpqUr01sJaJi@cluster0.shx85qq.mongodb.net/?appName=Cluster0` |
| `DB_NAME` | `voiceflow_db` |
| `COLLECTION_NAME` | `produits` |
| `SEARCH_INDEX_NAME` | `default` |

**Important:** 
- Values should **NOT** include the variable name
- Values should **NOT** have quotes around them
- Values should match exactly (case-sensitive)

## Step 5: Force Redeploy

After verifying variables:

1. **Vercel Dashboard** → Your Project → **Deployments**
2. Click **"..."** on latest deployment
3. Select **"Redeploy"**
4. **Uncheck** "Use existing Build Cache" (if option appears)
5. Click **"Redeploy"**
6. Wait for completion (1-2 minutes)

## Step 6: Test Again

After redeploying:

```powershell
# Health check
$url = "https://your-app.vercel.app/api/voiceflow/search"
Invoke-RestMethod -Uri $url -Method GET | ConvertTo-Json -Depth 5
```

**Expected:**
```json
{
  "status": "ok",
  "mongodb": {
    "connected": true,
    "status": "connected",
    "documentCount": 70230
  }
}
```

## Common Issues & Solutions

### Issue 1: Environment Variable Not Loading

**Symptom:** Health check shows `connected: false`

**Solution:**
- Verify variable names are exact (case-sensitive)
- Make sure variables are set for **Production, Preview, and Development**
- Redeploy after adding/updating variables

### Issue 2: Connection String Format

**Symptom:** Authentication errors

**Solution:**
- Remove any `MONGO_URI = ` prefix from the value
- Ensure connection string starts with `mongodb+srv://`
- Verify username and password are correct

### Issue 3: Network Access

**Symptom:** Timeout errors

**Solution:**
- MongoDB Atlas → Network Access
- Ensure `0.0.0.0/0` is in the list and **Active**
- Wait a few minutes after adding IPs

### Issue 4: Cached Deployment

**Symptom:** Changes not taking effect

**Solution:**
- Redeploy with cache disabled
- Or wait 5-10 minutes for cache to clear

## Quick Diagnostic Checklist

- [ ] Environment variables set in Vercel (all 4)
- [ ] Variable values don't include variable names
- [ ] Variables set for Production, Preview, and Development
- [ ] Application redeployed after setting variables
- [ ] MongoDB Atlas Network Access allows `0.0.0.0/0`
- [ ] Health check endpoint tested
- [ ] Vercel logs checked for specific errors

## Get Your Vercel URL

If you're not sure of your Vercel URL:

1. Go to **Vercel Dashboard**
2. Click on your project
3. The URL is shown at the top (e.g., `https://your-project.vercel.app`)
4. Or check **Settings** → **Domains**

## Still Not Working?

If after all these steps it still fails:

1. **Share your Vercel URL** so I can test it
2. **Share the error from Vercel logs** (from Step 2A)
3. **Share the health check response** (from Step 6)

This will help identify the exact issue!




