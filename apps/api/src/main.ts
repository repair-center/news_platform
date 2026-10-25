import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ErrorFilter } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? false, methods: ['GET', 'POST', 'PATCH'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('News Platform API').setVersion('0.1').addBearerAuth().build());
  SwaggerModule.setup('api/docs', app, doc);
  await app.listen(Number(process.env.API_PORT ?? 4000));
}
bootstrap();
