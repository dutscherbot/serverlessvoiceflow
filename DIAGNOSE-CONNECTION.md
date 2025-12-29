# 🔍 Diagnose Voiceflow Database Connection Issues

This guide helps you identify and fix database connection problems between Voiceflow and MongoDB.

## Quick Diagnostic

Run the diagnostic tool to check your setup:

```powershell
# Set your environment variables first
$env:MONGO_URI = "mongodb+srv://username:password@cluster.mongodb.net/"
$env:DB_NAME = "your_database_name"
$env:COLLECTION_NAME = "products"
$env:SEARCH_INDEX_NAME = "default"

# Run diagnostic
node diagnose-connection.js
```

## Common Issues & Solutions

### ❌ Issue 1: "MONGO_URI is not properly configured"

**Problem:** Environment variables are not set in Vercel.

**Solution:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `DB_NAME`: Your database name
   - `COLLECTION_NAME`: Your collection name (usually `products` or `produits`)
   - `SEARCH_INDEX_NAME`: Your search index name (usually `default`)
5. **Redeploy** your application (Settings → Deployments → Redeploy)

### ❌ Issue 2: "Failed to connect to MongoDB"

**Problem:** Connection string is incorrect or network is blocked.

**Check:**
1. **MongoDB Atlas Network Access:**
   - Go to MongoDB Atlas → Network Access
   - Ensure your IP is allowed OR allow all IPs (0.0.0.0/0) for Vercel
   - Vercel uses dynamic IPs, so allowing all IPs is recommended for serverless

2. **Connection String Format:**
   ```
   mongodb+srv://username:password@cluster.mongodb.net/
   ```
   - Replace `username` with your MongoDB username
   - Replace `password` with your MongoDB password (URL-encode special characters)
   - Replace `cluster.mongodb.net` with your actual cluster URL

3. **Password Special Characters:**
   - If password contains `@`, `#`, `%`, etc., URL-encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`
   - Or change your MongoDB password to avoid special characters

### ❌ Issue 3: "Search index does not exist"

**Problem:** Atlas Search index is not configured.

**Solution:**
1. Go to MongoDB Atlas → Search → Create Search Index
2. Use the configuration from `atlas-search-index-produits.json`
3. Name it `default` (or update `SEARCH_INDEX_NAME` in Vercel)
4. Wait for index to finish building (can take a few minutes)

### ❌ Issue 4: "Collection not found"

**Problem:** Collection name doesn't match.

**Solution:**
1. Check your actual collection name in MongoDB Atlas
2. Update `COLLECTION_NAME` in Vercel environment variables
3. Common names: `products`, `produits`, `items`

### ❌ Issue 5: Authentication Failed

**Problem:** Wrong credentials or user permissions.

**Solution:**
1. **Verify Username/Password:**
   - Go to MongoDB Atlas → Database Access
   - Check username and reset password if needed
   - Update `MONGO_URI` with correct credentials

2. **Check User Permissions:**
   - User needs `read` and `write` permissions
   - Go to Database Access → Edit User → Database User Privileges
   - Select "Read and write to any database" or specific database

## Testing Your Connection

### Test Locally

```powershell
# Set environment variables
$env:MONGO_URI = "mongodb+srv://username:password@cluster.mongodb.net/"
$env:DB_NAME = "your_database_name"
$env:COLLECTION_NAME = "products"

# Test connection
node diagnose-connection.js
```

### Test API Endpoint

```powershell
# Test health check
Invoke-RestMethod -Uri "https://your-vercel-app.vercel.app/api/voiceflow/search" -Method GET

# Test search
$body = @{ query = "test tubes" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://your-vercel-app.vercel.app/api/voiceflow/search" -Method POST -Body $body -ContentType "application/json"
```

## Vercel Environment Variables Setup

### Step-by-Step:

1. **Get MongoDB Connection String:**
   - MongoDB Atlas → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your actual password

2. **Add to Vercel:**
   ```
   Project → Settings → Environment Variables
   
   Add:
   - MONGO_URI = mongodb+srv://user:pass@cluster.mongodb.net/
   - DB_NAME = your_database_name
   - COLLECTION_NAME = products
   - SEARCH_INDEX_NAME = default
   ```

3. **Redeploy:**
   - Go to Deployments
   - Click "..." on latest deployment
   - Select "Redeploy"

## MongoDB Atlas Network Access

For Vercel (serverless), you need to allow all IPs:

1. MongoDB Atlas → Network Access
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere"
4. This adds `0.0.0.0/0` (all IPs)
5. Click "Confirm"

**Security Note:** This is safe because:
- MongoDB still requires authentication (username/password)
- Your connection string is secret
- Only users with credentials can access

## Verification Checklist

- [ ] Environment variables set in Vercel
- [ ] Application redeployed after setting variables
- [ ] MongoDB Atlas Network Access allows Vercel IPs (0.0.0.0/0)
- [ ] Connection string is correct (username, password, cluster URL)
- [ ] Database name matches `DB_NAME` variable
- [ ] Collection name matches `COLLECTION_NAME` variable
- [ ] Search index exists and matches `SEARCH_INDEX_NAME`
- [ ] MongoDB user has read/write permissions
- [ ] Health check endpoint returns `"connected": true`

## Still Having Issues?

1. **Check Vercel Logs:**
   - Vercel Dashboard → Your Project → Deployments
   - Click on a deployment → View Function Logs
   - Look for MongoDB connection errors

2. **Test Locally:**
   - Run `node diagnose-connection.js` locally
   - This helps identify if it's a Vercel-specific issue

3. **Verify MongoDB Atlas:**
   - Check cluster is running (not paused)
   - Verify database and collection exist
   - Check search index status (should be "Active")

4. **Common Error Messages:**
   - `"MONGO_URI is not properly configured"` → Set environment variables
   - `"Connection timeout"` → Check Network Access settings
   - `"Authentication failed"` → Verify username/password
   - `"Index not found"` → Create search index in Atlas

## Quick Fix Script

If you know your credentials, you can test everything at once:

```powershell
# Set these variables
$env:MONGO_URI = "mongodb+srv://YOUR_USER:YOUR_PASS@YOUR_CLUSTER.mongodb.net/"
$env:DB_NAME = "YOUR_DB"
$env:COLLECTION_NAME = "YOUR_COLLECTION"
$env:SEARCH_INDEX_NAME = "default"

# Run diagnostic
node diagnose-connection.js
```

This will tell you exactly what's wrong!

