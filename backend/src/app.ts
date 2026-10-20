import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { Container } from './container';
import { adminRoutes } from './modules/admin/http/admin.routes';
import { authRoutes } from './modules/auth/http/auth.routes';
import { bookingRoutes } from './modules/booking/http/booking.routes';
import { catalogRoutes } from './modules/catalog/http/catalog.routes';
import { paymentRoutes } from './modules/payment/http/payment.routes';
import { errorHandler, notFoundHandler } from './shared/http/errorHandler';

/** Збирає Express-застосунок із маршрутів усіх модулів. */
export function createApp(c: Container): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: c.config.corsOrigin }));

  // Вебхук платежів читає сире тіло, тому підключається ДО express.json().
  app.use('/api/payments', paymentRoutes(c.payments));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: c.clock.now() }));

  const { admin, complaints } = adminRoutes(c.admin, c.tokens);
  app.use('/api/auth', authRoutes(c.auth));
  app.use('/api/psychologists', catalogRoutes(c.catalog));
  app.use('/api', bookingRoutes({ schedule: c.schedule, booking: c.booking, reviews: c.reviews, cabinet: c.cabinet, tokens: c.tokens }));
  app.use('/api/complaints', complaints);
  app.use('/api/admin', admin);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
