import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('corsOrigin'),
    credentials: true,
  });

  app.setGlobalPrefix(config.get<string>('apiPrefix')!);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips properties not in the DTO
      forbidNonWhitelisted: false, // allows extra query params like ?status= on list endpoints
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('HRMS SaaS Platform API')
    .setDescription('Phase 1: Foundation — Auth, RBAC, Multi-Tenant, Company/Branch/Department, Employees')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('port')!;
  await app.listen(port);
  console.log(`🚀 HRMS API running on http://localhost:${port}/${config.get('apiPrefix')}`);
  console.log(`📘 Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
