// Simple test script to check database connection
const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Successfully connected to the database!');
    
    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Total users in database: ${userCount}`);
    
    // Test creating a simple query (optional)
    console.log('🔍 Testing database queries...');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

testConnection();