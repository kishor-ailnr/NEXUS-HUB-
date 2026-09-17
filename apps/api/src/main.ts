import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { initSentry } from './common/sentry';

async function bootstrap() {
  initSentry();
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT') || 4000;
  const rawOrigins = configService.get<string>('FRONTEND_ORIGIN') || 'http://localhost:5173,http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

  app.use(cookieParser());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-NW-Mode',
      'x-nw-mode',
      'X-NW-Admin',
      'x-nw-admin',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
  logger.log(`NEXUS WAYS API listening on port ${port}`);
  logger.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();
