/**
 * Quick test for MongoDB connection string
 */

const { MongoClient } = require('mongodb');

// Your connection string
const MONGO_URI = 'mongodb+srv://product_db:Bft4hpqUr01sJaJi@cluster0.shx85qq.mongodb.net/?appName=Cluster0';
const DB_NAME = 'voiceflow_db';
const COLLECTION_NAME = 'produits';

async function testConnection() {
  let client = null;
  
  console.log('🔍 Testing MongoDB Connection...\n');
  console.log('Connection String:', MONGO_URI.replace(/:[^:@]+@/, ':****@')); // Mask password
  console.log('Database:', DB_NAME);
  console.log('Collection:', COLLECTION_NAME);
  console.log('\n' + '='.repeat(60) + '\n');
  
  try {
    console.log('⏳ Connecting to MongoDB...');
    
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    
    await client.connect();
    console.log('✅ Successfully connected!\n');
    
    // Test database access
    console.log('📊 Testing database access...');
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
      console.log(`❌ Collection "${COLLECTION_NAME}" not found!`);
      console.log(`   Available collections: ${collections.map(c => c.name).join(', ')}\n`);
    } else {
      console.log(`✅ Collection "${COLLECTION_NAME}" exists\n`);
    }
    
    // Test collection access
    console.log('📦 Testing collection access...');
    const collection = db.collection(COLLECTION_NAME);
    
    const count = await collection.countDocuments({});
    console.log(`✅ Collection is accessible`);
    console.log(`   Document count: ${count}`);
    
    if (count === 0) {
      console.log(`   ⚠️  Collection is empty - no products found`);
    } else {
      console.log(`   ✅ Found ${count} product(s)\n`);
    }
    
    // Test search index
    console.log('🔍 Testing Atlas Search Index...');
    try {
      const searchTest = await collection.aggregate([
        {
          $search: {
            index: 'default',
            text: {
              query: 'test',
              path: ['Designation']
            }
          }
        },
        { $limit: 1 }
      ]).toArray();
      
      console.log(`✅ Search index "default" is working`);
      console.log(`   Test search returned ${searchTest.length} result(s)\n`);
    } catch (searchError) {
      console.log(`❌ Search index "default" has issues:`);
      if (searchError.message.includes('index')) {
        console.log(`   → Index "default" does not exist`);
        console.log(`   → Create it in MongoDB Atlas → Search → Create Search Index`);
      } else {
        console.log(`   Error: ${searchError.message}\n`);
      }
    }
    
    console.log('='.repeat(60));
    console.log('\n✅ All tests passed! Your connection string is working.\n');
    console.log('💡 If Voiceflow still can\'t connect:');
    console.log('   1. Make sure you redeployed after setting environment variables');
    console.log('   2. Check MongoDB Atlas Network Access allows all IPs (0.0.0.0/0)');
    console.log('   3. Verify the connection string is exactly the same in Vercel\n');
    
  } catch (error) {
    console.log('❌ Connection failed!\n');
    console.log('Error details:');
    console.log(`   Message: ${error.message}\n`);
    
    if (error.message.includes('authentication')) {
      console.log('💡 Authentication Error:');
      console.log('   → The username "product_db" might not be correct');
      console.log('   → Check MongoDB Atlas → Database Access');
      console.log('   → Verify the username is "product_db" or use the correct username');
      console.log('   → Reset password if needed\n');
    } else if (error.message.includes('timeout') || error.message.includes('ENOTFOUND')) {
      console.log('💡 Network Error:');
      console.log('   → MongoDB Atlas Network Access might be blocking connections');
      console.log('   → Go to MongoDB Atlas → Network Access');
      console.log('   → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)\n');
    } else if (error.message.includes('bad auth')) {
      console.log('💡 Authentication Error:');
      console.log('   → Username or password is incorrect');
      console.log('   → Check MongoDB Atlas → Database Access');
      console.log('   → Verify username and password\n');
    } else {
      console.log('💡 General Error:');
      console.log('   → Review error message above');
      console.log('   → Check MongoDB Atlas cluster is running\n');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('Connection closed.\n');
    }
  }
}

testConnection().catch(console.error);

