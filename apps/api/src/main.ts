import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger
          styleSrc: ["'self'", "'unsafe-inline'"],  // Required for Swagger
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Required for some frontend dev setups
    }),
  );

  // Rate limiting - auth endpoints (stricter)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 login attempts per window
    message: { message: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiting - general API (skip health checks used by the panel on every load)
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
  });

  // Relax limits in dev mode; disable general limiter entirely while developing
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    (authLimiter as any).windowMs = 60 * 1000;
    (authLimiter as any).max = 200;
    app.use('/auth', authLimiter);
    console.log('Rate limiting: auth only (general limiter disabled in development)');
  } else {
    app.use('/auth', authLimiter);
    app.use(generalLimiter);
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS with env-based allowlist
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174'];

  app.enableCors({
    origin: isDev ? true : allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: isDev ? undefined : 86400, // 24h cache for preflight in prod
  });

  // Swagger docs (dev only recommended)
  const config = new DocumentBuilder()
    .setTitle('LCH API — Sistema de Gestión')
    .setDescription('Sistema de Gestión LCH — La Chacra Fútbol')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  if (!isDev) {
    console.log('Running in PRODUCTION mode with security hardening enabled');
  }
}
bootstrap();
