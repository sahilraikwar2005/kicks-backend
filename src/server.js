import http from 'http';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

const server = http.createServer(app);

const startServer = async () => {
  try {
    await connectDatabase();
    server.listen(env.port, () => {
      console.log(`KICKS backend running on port ${env.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  console.log('Shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('Shutdown signal received');
  server.close(() => process.exit(0));
});

startServer();
