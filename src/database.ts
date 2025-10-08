import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], 
});


export async function connectToDatabase() {
  try {
    
    await prisma.$connect();
    console.log('✅ Successfully connected to the database!');
    
    return prisma;
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    throw error;
  }
}

export async function disconnectFromDatabase() {
  try {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
}

export async function createSampleUser() {
  try {
    const user = await prisma.user.create({
      data: {
        username: `user_${Date.now()}`,
        email: `user_${Date.now()}@example.com`,
        password: 'hashedpassword',
        saltPassword: 'salt',
        token: 'token',
        dateOfBirth: new Date('1990-01-01'),
        bio: 'Sample user created for testing',
      },
    });
    
    console.log('✨ Created sample user:', user.username);
    return user;
  } catch (error) {
    console.error('❌ Error creating sample user:', error);
    throw error;
  }
}

// Export the prisma client for use in other files
export default prisma;