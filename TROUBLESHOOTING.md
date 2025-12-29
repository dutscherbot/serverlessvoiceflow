# 🔧 Voiceflow Database Connection Troubleshooting

## Quick Diagnosis

The error message you're seeing:
> "Désolé, je ne peux pas me connecter à la base de données. Il semble y avoir un problème de connexion temporaire."

This means Voiceflow **cannot connect to your MongoDB database**. Here's how to fix it:

---

## ✅ Most Common Fixes (Try These First)

### Fix #1: Check Vercel Environment Variables ⚠️ **MOST COMMON**

**Problem:** Environment variables are not set in Vercel.

**Solution:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project → **Settings** → **Environment Variables**
3. Verify these 4 variables exist:
   - `MONGO_URI` - Your MongoDB connection string
   - `DB_NAME` - Your database name
   - `COLLECTION_NAME` - Your collection name (usually `products` or `produits`)
   - `SEARCH_INDEX_NAME` - Your search index name (usually `default`)
4. **If missing, add them**
5. **Redeploy** your application:
   - Go to **Deployments**
   - Click **"..."** on latest deployment
   - Select **"Redeploy"**

**How to get MONGO_URI:**
- MongoDB Atlas → **Connect** → **Connect your application**
- Copy the connection string
- Replace `<password>` with your actual password
- Format: `mongodb+srv://username:password@cluster.mongodb.net/`

---

### Fix #2: MongoDB Atlas Network Access 🔒

**Problem:** MongoDB is blocking connections from Vercel.

**Solution:**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your project → **Network Access**
3. Click **"Add IP Address"**
4. Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
5. Click **"Confirm"**

**Why this is safe:**
- MongoDB still requires username/password authentication
- Your connection string is secret
- Only authenticated users can access

---

### Fix #3: Verify Connection String Format 🔑

**Problem:** Connection string has wrong format or credentials.

**Check:**
- ✅ Format: `mongodb+srv://username:password@cluster.mongodb.net/`
- ✅ Username is correct (check MongoDB Atlas → Database Access)
- ✅ Password is correct (reset if needed)
- ✅ Special characters in password are URL-encoded:
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - Or change password to avoid special characters

**Test your connection string:**
```powershell
# Set environment variable
$env:MONGO_URI = "mongodb+srv://username:password@cluster.mongodb.net/"

# Run diagnostic
node diagnose-connection.js
```

---

### Fix #4: Check Database and Collection Names 📊

**Problem:** Database or collection name doesn't match.

**Solution:**
1. Go to MongoDB Atlas → **Browse Collections**
2. Note your actual:
   - Database name (e.g., `voiceflow_db`, `products_db`)
   - Collection name (e.g., `products`, `produits`, `items`)
3. Update Vercel environment variables to match:
   - `DB_NAME` = your actual database name
   - `COLLECTION_NAME` = your actual collection name
4. **Redeploy**

---

### Fix #5: Atlas Search Index 🔍

**Problem:** Search index doesn't exist or has wrong name.

**Solution:**
1. Go to MongoDB Atlas → **Search** → **Create Search Index**
2. Use configuration from `atlas-search-index-produits.json`
3. Name it `default` (or update `SEARCH_INDEX_NAME` in Vercel)
4. Wait for index to finish building (status: "Active")
5. **Redeploy** if you changed `SEARCH_INDEX_NAME`

---

## 🔍 Diagnostic Steps

### Step 1: Run Local Diagnostic

```powershell
# Set your environment variables
$env:MONGO_URI = "mongodb+srv://username:password@cluster.mongodb.net/"
$env:DB_NAME = "your_database_name"
$env:COLLECTION_NAME = "products"
$env:SEARCH_INDEX_NAME = "default"

# Run diagnostic
node diagnose-connection.js
```

This will tell you exactly what's wrong!

### Step 2: Test API Health Check

```powershell
# Replace with your Vercel URL
$url = "https://your-app.vercel.app/api/voiceflow/search"

# Test health check (GET request)
Invoke-RestMethod -Uri $url -Method GET
```

**Expected response:**
```json
{
  "status": "ok",
  "mongodb": {
    "connected": true,
    "status": "connected",
    "documentCount": 1234
  }
}
```

**If `connected: false`:**
- Check Vercel environment variables
- Check MongoDB Atlas Network Access
- Check connection string format

### Step 3: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project
2. Click on a **Deployment**
3. Click **"View Function Logs"**
4. Look for MongoDB connection errors
5. Check error messages for specific issues

---

## 📋 Checklist

Before contacting support, verify:

- [ ] Environment variables set in Vercel (MONGO_URI, DB_NAME, COLLECTION_NAME, SEARCH_INDEX_NAME)
- [ ] Application redeployed after setting variables
- [ ] MongoDB Atlas Network Access allows all IPs (0.0.0.0/0)
- [ ] Connection string is correct (username, password, cluster URL)
- [ ] Database name matches `DB_NAME` variable
- [ ] Collection name matches `COLLECTION_NAME` variable
- [ ] Search index exists and matches `SEARCH_INDEX_NAME`
- [ ] MongoDB user has read/write permissions
- [ ] Health check endpoint returns `"connected": true`
- [ ] Local diagnostic (`diagnose-connection.js`) passes all checks

---

## 🚨 Common Error Messages

### "MONGO_URI is not properly configured"
**Fix:** Set `MONGO_URI` in Vercel environment variables

### "Connection timeout"
**Fix:** Allow all IPs in MongoDB Atlas Network Access (0.0.0.0/0)

### "Authentication failed"
**Fix:** Verify username and password in `MONGO_URI`

### "Index not found"
**Fix:** Create search index in MongoDB Atlas → Search

### "Collection not found"
**Fix:** Check collection name matches `COLLECTION_NAME` variable

---

## 🛠️ Quick Fix Script

If you know your credentials:

```powershell
# 1. Test locally first
$env:MONGO_URI = "mongodb+srv://YOUR_USER:YOUR_PASS@YOUR_CLUSTER.mongodb.net/"
$env:DB_NAME = "YOUR_DB"
$env:COLLECTION_NAME = "YOUR_COLLECTION"
node diagnose-connection.js

# 2. If local test passes, add to Vercel:
#    Vercel Dashboard → Settings → Environment Variables
#    Add: MONGO_URI, DB_NAME, COLLECTION_NAME, SEARCH_INDEX_NAME

# 3. Redeploy
#    Vercel Dashboard → Deployments → Redeploy
```

---

## 📞 Still Not Working?

1. **Run diagnostic:** `node diagnose-connection.js`
2. **Check Vercel logs** for specific error messages
3. **Test health endpoint** to see connection status
4. **Verify MongoDB Atlas** cluster is running (not paused)

Most issues are resolved by:
1. ✅ Setting environment variables in Vercel
2. ✅ Allowing all IPs in MongoDB Atlas Network Access
3. ✅ Redeploying the application

---

## 💡 Pro Tips

- **Always redeploy** after changing environment variables
- **Test locally first** with `diagnose-connection.js` before deploying
- **Use descriptive error messages** - the code now provides better diagnostics
- **Check Vercel logs** - they show exactly what's failing
- **Health check endpoint** - use it to verify connection status

---

**Need more help?** Check `DIAGNOSE-CONNECTION.md` for detailed diagnostic steps.

