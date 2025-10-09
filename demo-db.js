// Enhanced test script with more database operations
const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], // Enable logging to see what's happening
});

async function demonstrateDatabaseOperations() {
  try {
    console.log('🚀 Starting comprehensive database test...\n');
    
    // 1. Test connection
    console.log('1️⃣ Testing database connection...');
    await prisma.$connect();
    console.log('✅ Successfully connected to the database!\n');
    
    // 2. Get database statistics
    console.log('2️⃣ Fetching database statistics...');
    const userCount = await prisma.user.count();
    const tweetCount = await prisma.tweet.count();
    const followCount = await prisma.follow.count();
    
    console.log(`📊 Database Statistics:`);
    console.log(`   👥 Total users: ${userCount}`);
    console.log(`   🐦 Total tweets: ${tweetCount}`);
    console.log(`   🤝 Total follows: ${followCount}\n`);
    
    // 3. Demonstrate creating a user (commented out to avoid creating test data)
    console.log('3️⃣ Database schema validation...');
    
    // Test that all models are accessible
    const models = [
      'user', 'tweet', 'follow', 'message', 'chat', 'chatUser',
      'mention', 'retweet', 'tweetLike', 'tweetBookmark', 'mute', 'block'
    ];
    
    console.log('📋 Available database models:');
    for (const model of models) {
      if (prisma[model]) {
        console.log(`   ✅ ${model} model is accessible`);
      } else {
        console.log(`   ❌ ${model} model is not accessible`);
      }
    }
    
    console.log('\n4️⃣ Testing a simple query...');
    // Try to get the first user (if any exists)
    const firstUser = await prisma.user.findFirst();
    if (firstUser) {
      console.log(`👤 Found user: ${firstUser.username} (${firstUser.email})`);
    } else {
      console.log('👥 No users found in the database (this is normal for a new database)');
    }
    
    console.log('\n🎉 All database tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Database test failed:');
    console.error(`Error: ${error.message}`);
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the demonstration
demonstrateDatabaseOperations();