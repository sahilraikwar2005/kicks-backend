import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import { env } from './config/env.js';
import { securityMiddleware } from './middleware/security.middleware.js';
import { apiRateLimiter } from './middleware/rateLimit.middleware.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import routes from './routes/index.js';
import { requestContext, csrfOriginGuard } from './middleware/request.middleware.js';

const app = express();

app.use(requestContext);
app.use(securityMiddleware.helmet);
app.use(securityMiddleware.cors);
app.use(securityMiddleware.compression);
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/shipments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: env.maxRequestBodySize }));
app.use(express.urlencoded({ extended: true, limit: env.maxRequestBodySize }));
app.use(cookieParser());
app.use(csrfOriginGuard);
app.use(mongoSanitizeMiddleware());
app.use(securityMiddleware.hpp);
app.use(apiRateLimiter);
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/v1/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    success: true,
    message: 'KICKS API is running',
    database: databaseReady ? 'connected' : 'unavailable',
  });
});

app.use('/api/v1', routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;

function mongoSanitizeMiddleware() {
  return securityMiddleware.mongoSanitize;
}
