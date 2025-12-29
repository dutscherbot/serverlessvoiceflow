# ✅ Verify Your Vercel Environment Variables

Based on your screenshot, here's what to check:

## Current Configuration

From your Vercel dashboard:
- ✅ **DB_NAME**: `voiceflow_db`
- ✅ **SEARCH_INDEX_NAME**: `default`
- ⚠️ **MONGO_URI**: `mongodb+srv://product_db:Bft4hpqU...` (needs verification)
- ❓ **COLLECTION_NAME**: Masked (needs verification)

---

## 🔍 Step 1: Verify MONGO_URI Format

Your `MONGO_URI` shows: `mongodb+srv://product_db:Bft4hpqU...`

**Correct format should be:**
```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/
```

### How to Get the Correct Connection String:

1. **Go to MongoDB Atlas:**
   - Login to [MongoDB Atlas](https://cloud.mongodb.com/)
   - Select your project

2. **Get Connection String:**
   - Click **"Connect"** button on your cluster
   - Select **"Connect your application"**
   - Copy the connection string
   - It should look like:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```

3. **Replace Placeholders:**
   - Replace `<username>` with your MongoDB username
   - Replace `<password>` with your MongoDB password
   - **Important:** If password has special characters, URL-encode them:
     - `@` → `%40`
     - `#` → `%23`
     - `%` → `%25`

4. **Update in Vercel:**
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Click on `MONGO_URI`
   - Update with the correct connection string
   - Click **"Save"**

---

## 🔍 Step 2: Verify COLLECTION_NAME

Your `COLLECTION_NAME` is masked. You need to check what it's set to.

### How to Check:

1. **In Vercel:**
   - Click on `COLLECTION_NAME` variable
   - Click the eye icon to reveal the value
   - Common values: `products`, `produits`, `items`

2. **In MongoDB Atlas:**
   - Go to **Browse Collections**
   - Check what your collection is actually named
   - It should match the `COLLECTION_NAME` variable

3. **Update if needed:**
   - If it doesn't match, update `COLLECTION_NAME` in Vercel
   - Common names: `products`, `produits`

---

## 🔍 Step 3: Verify All Variables Match

Make sure these match between Vercel and MongoDB Atlas:

| Vercel Variable | Should Match | Where to Check |
|----------------|--------------|----------------|
| `DB_NAME` | Database name | MongoDB Atlas → Browse Collections → Database name |
| `COLLECTION_NAME` | Collection name | MongoDB Atlas → Browse Collections → Collection name |
| `MONGO_URI` | Connection string | MongoDB Atlas → Connect → Connect your application |
| `SEARCH_INDEX_NAME` | Search index name | MongoDB Atlas → Search → Index name |

---

## 🔍 Step 4: Common Issues with MONGO_URI

### Issue 1: Wrong Username
- ❌ `mongodb+srv://product_db:password@...` (using database name as username)
- ✅ `mongodb+srv://your_username:password@...` (use actual MongoDB username)

**Fix:**
- MongoDB Atlas → Database Access
- Check your actual username
- Use that in the connection string

### Issue 2: Password Special Characters
- If password contains `@`, `#`, `%`, etc., they need URL encoding
- Example: Password `P@ss#123` becomes `P%40ss%23123`

**Fix:**
- Either URL-encode special characters
- Or change MongoDB password to avoid special characters

### Issue 3: Missing Cluster URL
- Connection string should include your cluster URL
- Format: `@cluster0.xxxxx.mongodb.net/`

**Fix:**
- Get the full connection string from MongoDB Atlas → Connect

---

## ✅ Verification Checklist

After updating, verify:

- [ ] `MONGO_URI` starts with `mongodb+srv://`
- [ ] `MONGO_URI` contains `@` (separates credentials from cluster)
- [ ] `MONGO_URI` contains your cluster URL (e.g., `cluster0.xxxxx.mongodb.net`)
- [ ] `DB_NAME` matches your actual database name in MongoDB Atlas
- [ ] `COLLECTION_NAME` matches your actual collection name
- [ ] `SEARCH_INDEX_NAME` matches your search index name (usually `default`)
- [ ] All variables are set for **Production, Preview, and Development**

---

## 🚀 After Updating Variables

**IMPORTANT:** You must redeploy after changing environment variables!

1. **Go to Vercel Dashboard**
2. **Click on your project**
3. **Go to "Deployments"**
4. **Click "..." on the latest deployment**
5. **Select "Redeploy"**
6. **Wait for deployment to complete**

---

## 🧪 Test Your Configuration

After redeploying, test the connection:

### Option 1: Health Check (Easiest)
```powershell
# Replace with your Vercel URL
$url = "https://your-app.vercel.app/api/voiceflow/search"
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

### Option 2: Test Search
```powershell
$body = @{ query = "test tubes" } | ConvertTo-Json
$url = "https://your-app.vercel.app/api/voiceflow/search"
Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
```

---

## 🔧 Quick Fix Steps

1. **Get correct MONGO_URI:**
   - MongoDB Atlas → Connect → Connect your application
   - Copy and replace `<username>` and `<password>`

2. **Check COLLECTION_NAME:**
   - MongoDB Atlas → Browse Collections
   - Note the collection name
   - Update in Vercel if different

3. **Update Vercel:**
   - Settings → Environment Variables
   - Update `MONGO_URI` and `COLLECTION_NAME` if needed
   - Click "Save"

4. **Redeploy:**
   - Deployments → Redeploy latest

5. **Test:**
   - Use health check endpoint to verify connection

---

## ❓ Still Having Issues?

If connection still fails after updating:

1. **Check MongoDB Atlas Network Access:**
   - Network Access → Add IP Address
   - Allow all IPs: `0.0.0.0/0`

2. **Verify MongoDB User Permissions:**
   - Database Access → Your User
   - Should have "Read and write to any database"

3. **Run Local Diagnostic:**
   ```powershell
   $env:MONGO_URI = "your_connection_string"
   $env:DB_NAME = "voiceflow_db"
   $env:COLLECTION_NAME = "your_collection_name"
   node diagnose-connection.js
   ```

---

## 📝 Summary

**Your current setup:**
- ✅ DB_NAME: `voiceflow_db` (looks good)
- ✅ SEARCH_INDEX_NAME: `default` (looks good)
- ⚠️ MONGO_URI: Needs verification (format might be wrong)
- ❓ COLLECTION_NAME: Needs to be checked (currently masked)

**Action items:**
1. Verify `MONGO_URI` format is correct
2. Check what `COLLECTION_NAME` is set to
3. Update if needed
4. Redeploy application
5. Test connection

