import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

const server = app.listen(env.PORT, async () => {
  console.log(`========================================================`);
  console.log(`🚀 MIFOS Production Backend API Server`);
  console.log(`📡 Port: ${env.PORT}`);
  console.log(`🌐 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 API Base: http://localhost:${env.PORT}/api/v1`);
  console.log(`========================================================`);

  try {
    await prisma.$connect();
    console.log(`✅ Supabase PostgreSQL Database Connected Successfully.`);
  } catch (err: any) {
    console.error(`❌ Database Connection Error:`, err.message);
  }
});

// Graceful Shutdown
const shutdown = async () => {
  console.log(`\n🛑 Gracefully shutting down MIFOS backend server...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log(`💤 Prisma Disconnected. Server closed.`);
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

