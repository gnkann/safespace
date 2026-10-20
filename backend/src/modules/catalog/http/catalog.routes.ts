import { Router } from 'express';
import { asyncHandler } from '../../../shared/http/asyncHandler';
import { ValidationError } from '../../../shared/errors';
import { CatalogService } from '../CatalogService';

const num = (v: unknown, field: string): number | undefined => {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) throw new ValidationError(`Некоректне значення ${field}`);
  return n;
};
const date = (v: unknown, field: string): Date | undefined => {
  if (v === undefined || v === '') return undefined;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new ValidationError(`Некоректна дата ${field}`);
  return d;
};

/** Публічні маршрути каталогу (автентифікація не потрібна). */
export function catalogRoutes(catalog: CatalogService): Router {
  const r = Router();

  r.get('/', asyncHandler(async (req, res) => {
    const cards = await catalog.search({
      specialization: req.query.specialization ? String(req.query.specialization) : undefined,
      minPrice: num(req.query.minPrice, 'minPrice'),
      maxPrice: num(req.query.maxPrice, 'maxPrice'),
      availableFrom: date(req.query.from, 'from'),
      availableTo: date(req.query.to, 'to'),
    });
    res.json(cards);
  }));

  r.get('/:id', asyncHandler(async (req, res) => {
    res.json(await catalog.getProfile(req.params.id));
  }));

  return r;
}
