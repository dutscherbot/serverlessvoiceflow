/**
 * Test Vercel Environment Variables Connection
 * Uses the exact connection string from Vercel
 */

const { MongoClient } = require('mongodb');

// Your Vercel environment variables (from screenshot)
const MONGO_URI = 'mongodb+srv://product_db:Bft4hpqUr01sJaJi@cluster0.shx85qq.mongodb.net/?appName=Cluster0';
const DB_NAME = 'voiceflow_db';
const COLLECTION_NAME = 'produits';
const SEARCH_INDEX_NAME = 'default';

console.log('🧪 Testing Vercel Environment Variables Connection\n');
console.log('='.repeat(60));
console.log('\n📋 Configuration:');
console.log(`   Database: ${DB_NAME}`);
console.log(`   Collection: ${COLLECTION_NAME}`);
console.log(`   Search Index: ${SEARCH_INDEX_NAME}`);
console.log(`   Connection: mongodb+srv://product_db:***@cluster0.shx85qq.mongodb.net/\n`);

async function testConnection() {
  let client = null;
  
  try {
    console.log('🔌 Step 1: Testing MongoDB Connection...\n');
    
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!\n');
    
    // Test database access
    console.log('📊 Step 2: Testing Database Access...\n');
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
      console.log(`❌ Collection "${COLLECTION_NAME}" NOT FOUND!`);
      console.log(`   Available collections: ${collections.map(c => c.name).join(', ')}`);
      console.log(`   → Update COLLECTION_NAME in Vercel to match one of the above\n`);
      return;
    } else {
      console.log(`✅ Collection "${COLLECTION_NAME}" exists\n`);
    }
    
    // Test collection access
    console.log('📦 Step 3: Testing Collection Access...\n');
    const collection = db.collection(COLLECTION_NAME);
    
    const count = await collection.countDocuments({});
    console.log(`✅ Collection is accessible`);
    console.log(`   Document count: ${count}`);
    
    if (count === 0) {
      console.log(`   ⚠️  Collection is empty - no products found`);
      console.log(`   → Import products to this collection\n`);
    } else {
      console.log(`   ✅ Found ${count} product(s)\n`);
      
      // Show a sample product
      const sample = await collection.findOne({});
      console.log('📄 Sample Product:');
      console.log(JSON.stringify(sample, null, 2));
      console.log();
    }
    
    // Test search index
    console.log('🔍 Step 4: Testing Atlas Search Index...\n');
    try {
      const searchTest = await collection.aggregate([
        {
          $search: {
            index: SEARCH_INDEX_NAME,
            text: {
              query: 'tube',
              path: ['Designation']
            }
          }
        },
        { $limit: 1 }
      ]).toArray();
      
      console.log(`✅ Search index "${SEARCH_INDEX_NAME}" is working`);
      console.log(`   Test search for "tube" returned ${searchTest.length} result(s)\n`);
    } catch (searchError) {
      console.log(`❌ Search index "${SEARCH_INDEX_NAME}" has issues:`);
      if (searchError.message.includes('index')) {
        console.log(`   → Index "${SEARCH_INDEX_NAME}" does not exist`);
        console.log(`   → Create it in MongoDB Atlas → Search → Create Search Index`);
        console.log(`   → Use configuration from: atlas-search-index-produits.json\n`);
      } else {
        console.log(`   Error: ${searchError.message}\n`);
      }
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log('\n✅ SUCCESS! Your connection is working!\n');
    console.log('📋 Summary:');
    console.log(`   ✅ MongoDB connection: Working`);
    console.log(`   ✅ Database "${DB_NAME}": Exists`);
    console.log(`   ✅ Collection "${COLLECTION_NAME}": Exists (${count} documents)`);
    console.log(`   ${targetCollection ? '✅' : '❌'} Collection matches Vercel config`);
    console.log(`   ${count > 0 ? '✅' : '⚠️ '} Collection has data`);
    console.log();
    console.log('💡 Next Steps:');
    console.log('   1. If search index failed, create it in MongoDB Atlas');
    console.log('   2. Redeploy your Vercel application');
    console.log('   3. Test the API endpoint');
    console.log();
    
  } catch (error) {
    console.log('❌ Connection Failed!\n');
    console.log('Error details:');
    console.log(`   Message: ${error.message}\n`);
    
    if (error.message.includes('authentication')) {
      console.log('💡 Authentication Error:');
      console.log('   → Username "product_db" or password is incorrect');
      console.log('   → Go to MongoDB Atlas → Database Access');
      console.log('   → Verify username and password');
      console.log('   → Reset password if needed\n');
    } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      console.log('💡 Network Error:');
      console.log('   → MongoDB Atlas Network Access is blocking connections');
      console.log('   → Go to MongoDB Atlas → Network Access');
      console.log('   → Click "Add IP Address" → "Allow Access from Anywhere"');
      console.log('   → This adds 0.0.0.0/0 (all IPs)\n');
    } else if (error.message.includes('bad auth')) {
      console.log('💡 Authentication Error:');
      console.log('   → Username or password is wrong');
      console.log('   → Check MongoDB Atlas → Database Access');
      console.log('   → Verify user exists and has correct password\n');
    } else {
      console.log('💡 General Error:');
      console.log('   → Check error message above');
      console.log('   → Verify MongoDB Atlas cluster is running (not paused)');
      console.log('   → Check connection string format\n');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('Connection closed.\n');
    }
  }
}

// Run test
testConnection().catch(console.error);

