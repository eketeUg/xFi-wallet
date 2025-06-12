import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    credentials: true,
  });
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done: any) => done(null, user));
  passport.deserializeUser((obj: any, done: any) => done(null, obj));
  await app.listen(3827);
}
bootstrap();
