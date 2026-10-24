const app = require('./app');
const prisma = require('./lib/prisma');
const { port } = require('./config/env');

async function startServer() {
  try {
    await prisma.$connect();

    app.listen(port, '0.0.0.0', () => {
      console.log(`Monolithic API running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start API:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);