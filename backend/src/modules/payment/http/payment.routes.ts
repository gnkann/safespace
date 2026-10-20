import express, { Router } from 'express';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { PaymentService } from '../PaymentService';

/**
 * Вебхук платіжного провайдера. Тіло читається як «сирий» текст —
 * це потрібно для перевірки підпису Stripe.
 */
export function paymentRoutes(payments: PaymentService): Router {
  const r = Router();
  r.post('/webhook', express.text({ type: '*/*' }), asyncHandler(async (req, res) => {
    await payments.handleWebhook(String(req.body ?? ''), req.header('stripe-signature'));
    res.status(200).json({ received: true });
  }));
  return r;
}
