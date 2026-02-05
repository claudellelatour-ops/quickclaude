import { PrismaClient } from '@prisma/client';
import { env, isDevelopment } from './env';

// Create Prisma client with logging in development
export const prisma = new PrismaClient({
  log: isDevelopment
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Test database connection
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

export default prisma;
