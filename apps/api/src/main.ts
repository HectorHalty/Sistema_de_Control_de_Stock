import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isDev = process.env.NODE_ENV !== 'production';

  // Caddy sits in front in production and sets X-Forwarded-For; rate-limit needs this.
  if (!isDev) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // CORS before rate limit — 429 without ACAO makes browsers report "Failed to fetch".
  const CAPACITOR_ORIGINS = [
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
  ];
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:5174'];
  const adminDomain = process.env.ADMIN_DOMAIN?.trim();
  const adminWebOrigins = adminDomain
    ? [`https://${adminDomain}`, `http://${adminDomain}`]
    : [];
  const productionOrigins = [...new Set([...envOrigins, ...CAPACITOR_ORIGINS, ...adminWebOrigins])];

  if (!isDev) {
    console.log(`CORS allowlist: ${productionOrigins.join(', ')}`);
  }

  app.enableCors({
    origin: isDev
      ? true
      : (origin, callback) => {
          if (!origin || productionOrigins.includes(origin)) {
            callback(null, true);
          } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: isDev ? undefined : 86400, // 24h cache for preflight in prod
  });

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

  const skipHeavyReadPaths = (req: { method: string; path: string }) =>
    req.method === 'OPTIONS'
    || req.path === '/health'
    || req.path === '/auth/me'
    || req.path === '/auth/login'
    // User management is low-traffic and auth/role-protected; avoid lockouts by limiter.
    || req.path.startsWith('/users');

  const defaultAuthWindowMs = 15 * 60 * 1000;
  const defaultAuthMax = isDev ? 200 : 100;
  const authWindowMsRaw = Number(process.env.AUTH_LIMIT_WINDOW_MS);
  const authMaxRaw = Number(process.env.AUTH_LIMIT_MAX);
  const authWindowMs = Number.isFinite(authWindowMsRaw) && authWindowMsRaw > 0
    ? authWindowMsRaw
    : defaultAuthWindowMs;
  const authMax = Number.isFinite(authMaxRaw) && authMaxRaw > 0
    ? authMaxRaw
    : defaultAuthMax;

  // Login brute-force protection only — NOT /auth/me (runs on every SPA reload).
  // Count only failed logins so normal operator usage doesn't exhaust the limit.
  const authLimiter = rateLimit({
    windowMs: authWindowMs,
    max: authMax,
    skipSuccessfulRequests: true,
    message: { message: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
  });

  // SPA boot hydrates ~12 GET endpoints per reload; 100/15min blocked normal use.
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    skip: skipHeavyReadPaths,
  });

  // Relax limits in dev mode; disable general limiter entirely while developing
  if (isDev) {
    app.use('/auth/login', authLimiter);
    console.log(`Rate limiting: login only (window=${authWindowMs}ms max=${authMax}, only failed attempts)`);
  } else {
    app.use('/auth/login', authLimiter);
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

  if (isDev) {
    const config = new DocumentBuilder()
      .setTitle('LCH API — Sistema de Gestión')
      .setDescription('Sistema de Gestión LCH — La Chacra Fútbol')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  if (isDev) {
    console.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
  if (!isDev) {
    console.log('Running in PRODUCTION mode with security hardening enabled');
  }
}
bootstrap();
