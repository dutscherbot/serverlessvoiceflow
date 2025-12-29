/**
 * MongoDB Connection Diagnostic Tool
 * Helps identify why Voiceflow can't connect to the database
 */

const { MongoClient } = require('mongodb');

// Get environment variables
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/';
const DB_NAME = process.env.DB_NAME || 'your_database_name';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'products';
const SEARCH_INDEX_NAME = process.env.SEARCH_INDEX_NAME || 'default';

console.log('🔍 MongoDB Connection Diagnostic Tool\n');
console.log('=' .repeat(60));

// Step 1: Check Environment Variables
console.log('\n📋 Step 1: Checking Environment Variables...\n');

const checks = {
  MONGO_URI: {
    value: MONGO_URI,
    configured: !MONGO_URI.includes('username:password') && !MONGO_URI.includes('your_') && MONGO_URI !== 'mongodb+srv://username:password@cluster.mongodb.net/',
    issues: []
  },
  DB_NAME: {
    value: DB_NAME,
    configured: DB_NAME !== 'your_database_name' && DB_NAME.length > 0,
    issues: []
  },
  COLLECTION_NAME: {
    value: COLLECTION_NAME,
    configured: COLLECTION_NAME.length > 0,
    issues: []
  },
  SEARCH_INDEX_NAME: {
    value: SEARCH_INDEX_NAME,
    configured: SEARCH_INDEX_NAME.length > 0,
    issues: []
  }
};

// Analyze MONGO_URI
if (!checks.MONGO_URI.configured) {
  checks.MONGO_URI.issues.push('❌ MONGO_URI is not configured (still using placeholder)');
  checks.MONGO_URI.issues.push('   → Set MONGO_URI in Vercel environment variables');
  checks.MONGO_URI.issues.push('   → Format: mongodb+srv://username:password@cluster.mongodb.net/');
} else {
  // Check URI format
  if (!MONGO_URI.startsWith('mongodb+srv://')) {
    checks.MONGO_URI.issues.push('⚠️  MONGO_URI should start with mongodb+srv://');
  }
  if (!MONGO_URI.includes('@')) {
    checks.MONGO_URI.issues.push('⚠️  MONGO_URI appears to be missing credentials');
  }
  if (MONGO_URI.includes('password') && !MONGO_URI.includes('@')) {
    checks.MONGO_URI.issues.push('⚠️  MONGO_URI may have placeholder password');
  }
}

// Analyze DB_NAME
if (!checks.DB_NAME.configured) {
  checks.DB_NAME.issues.push('❌ DB_NAME is not configured (still using placeholder)');
  checks.DB_NAME.issues.push('   → Set DB_NAME in Vercel environment variables');
}

// Display results
Object.entries(checks).forEach(([key, check]) => {
  const status = check.configured ? '✅' : '❌';
  console.log(`${status} ${key}:`);
  if (check.configured) {
    // Mask sensitive parts
    if (key === 'MONGO_URI') {
      const masked = MONGO_URI.replace(/(mongodb\+srv:\/\/)([^:]+):([^@]+)@/, '$1***:***@');
      console.log(`   Value: ${masked}`);
    } else {
      console.log(`   Value: ${check.value}`);
    }
  } else {
    console.log(`   Value: ${check.value} (NOT CONFIGURED)`);
  }
  if (check.issues.length > 0) {
    check.issues.forEach(issue => console.log(`   ${issue}`));
  }
  console.log();
});

// Step 2: Test Connection
console.log('\n🔌 Step 2: Testing MongoDB Connection...\n');

if (!checks.MONGO_URI.configured || !checks.DB_NAME.configured) {
  console.log('⚠️  Skipping connection test - environment variables not configured');
  console.log('\n📝 Next Steps:');
  console.log('1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.log('2. Add the following variables:');
  console.log('   - MONGO_URI: Your MongoDB Atlas connection string');
  console.log('   - DB_NAME: Your database name');
  console.log('   - COLLECTION_NAME: Your collection name (default: products)');
  console.log('   - SEARCH_INDEX_NAME: Your search index name (default: default)');
  console.log('3. Redeploy your application');
  process.exit(1);
}

async function testConnection() {
  let client = null;
  
  try {
    console.log('Attempting to connect...');
    
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!\n');
    
    // Test database access
    console.log('📊 Step 3: Testing Database Access...\n');
    const db = client.db(DB_NAME);
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`✅ Database "${DB_NAME}" exists`);
    console.log(`   Found ${collections.length} collection(s):`);
    collections.forEach(col => {
      const marker = col.name === COLLECTION_NAME ? ' ← (using this)' : '';
      console.log(`   - ${col.name}${marker}`);
    });
    console.log();
    
    // Check if target collection exists
    const targetCollection = collections.find(c => c.name === COLLECTION_NAME);
    if (!targetCollection) {
      console.log(`⚠️  Collection "${COLLECTION_NAME}" not found!`);
      console.log(`   → Create it or update COLLECTION_NAME environment variable\n`);
    } else {
      console.log(`✅ Collection "${COLLECTION_NAME}" exists\n`);
    }
    
    // Test collection access
    console.log('📦 Step 4: Testing Collection Access...\n');
    const collection = db.collection(COLLECTION_NAME);
    
    const count = await collection.countDocuments({});
    console.log(`✅ Collection is accessible`);
    console.log(`   Document count: ${count}`);
    
    if (count === 0) {
      console.log(`   ⚠️  Collection is empty - no products found`);
    } else {
      console.log(`   ✅ Found ${count} product(s)\n`);
    }
    
    // Test search index (if using Atlas Search)
    console.log('🔍 Step 5: Testing Atlas Search Index...\n');
    try {
      // Try a simple search aggregation
      const searchTest = await collection.aggregate([
        {
          $search: {
            index: SEARCH_INDEX_NAME,
            text: {
              query: 'test',
              path: ['Designation']
            }
          }
        },
        { $limit: 1 }
      ]).toArray();
      
      console.log(`✅ Search index "${SEARCH_INDEX_NAME}" is working`);
      console.log(`   Test search returned ${searchTest.length} result(s)\n`);
    } catch (searchError) {
      console.log(`❌ Search index "${SEARCH_INDEX_NAME}" has issues:`);
      if (searchError.message.includes('index')) {
        console.log(`   → Index "${SEARCH_INDEX_NAME}" does not exist`);
        console.log(`   → Create it in MongoDB Atlas → Search → Create Search Index`);
        console.log(`   → Use the configuration from: atlas-search-index-produits.json\n`);
      } else {
        console.log(`   Error: ${searchError.message}\n`);
      }
    }
    
    // Summary
    console.log('=' .repeat(60));
    console.log('\n📋 Summary:\n');
    
    const allConfigured = Object.values(checks).every(c => c.configured);
    const collectionExists = !!targetCollection;
    const hasData = count > 0;
    
    if (allConfigured && collectionExists && hasData) {
      console.log('✅ All checks passed! Your database should be working.');
      console.log('\n💡 If Voiceflow still can\'t connect:');
      console.log('   1. Check Vercel deployment logs for errors');
      console.log('   2. Verify environment variables are set in Vercel');
      console.log('   3. Ensure MongoDB Atlas Network Access allows Vercel IPs');
      console.log('   4. Check if search index is properly configured\n');
    } else {
      console.log('⚠️  Some issues found. Please fix them before using Voiceflow.\n');
    }
    
  } catch (error) {
    console.log('❌ Connection failed!\n');
    console.log('Error details:');
    console.log(`   Message: ${error.message}`);
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication Error - Possible causes:');
      console.log('   1. Wrong username or password in MONGO_URI');
      console.log('   2. User doesn\'t have access to the database');
      console.log('   3. Special characters in password need URL encoding');
    } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Network Error - Possible causes:');
      console.log('   1. MongoDB Atlas Network Access is blocking your IP');
      console.log('   2. Check MongoDB Atlas → Network Access → Add IP Address');
      console.log('   3. For Vercel, you may need to allow all IPs (0.0.0.0/0)');
      console.log('   4. Or use MongoDB Atlas IP Access List with Vercel IPs');
    } else if (error.message.includes('bad auth')) {
      console.log('\n💡 Authentication Error:');
      console.log('   1. Verify username and password in MONGO_URI');
      console.log('   2. Check if user exists in MongoDB Atlas');
      console.log('   3. Ensure user has read/write permissions');
    } else {
      console.log('\n💡 General Error:');
      console.log('   1. Verify MONGO_URI format is correct');
      console.log('   2. Check MongoDB Atlas cluster is running');
      console.log('   3. Review error message above for specific issues');
    }
    
    console.log();
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('Connection closed.\n');
    }
  }
}

// Run diagnostic
testConnection().catch(console.error);

