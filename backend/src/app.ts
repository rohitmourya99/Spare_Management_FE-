import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './config/logger';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // allow images/data URLs
}));

// CORS - Flexible origin support for development & deployment
app.use(cors({
  origin: (_origin, callback) => callback(null, true),
  credentials: true,
}));

// Compression for fast API payload transfers
app.use(compression({
  threshold: 512,
  level: 6,
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Serve static uploaded files
const uploadDir = path.resolve(env.UPLOAD_DIR);
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// API Routes
app.use('/api', routes);

// Serve frontend static build files (Single-Site Deployment)
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/uploads')) {
    return next();
  }

  const possibleFrontendPaths = [
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../../../frontend/dist'),
    '/opt/render/project/src/frontend/dist',
  ];

  const activeDistPath = possibleFrontendPaths.find((p) => fs.existsSync(p));

  if (activeDistPath) {
    const filePath = path.join(activeDistPath, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }

    const indexPath = path.join(activeDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  next();
});

// 404 & Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
