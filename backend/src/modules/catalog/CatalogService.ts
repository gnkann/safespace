import { NotFoundError } from '../../shared/errors';
import { Psychologist } from '../auth/domain/Psychologist';
import { PsychologistCard, PsychologistFilter, PsychologistProfileView } from './domain/PsychologistFilter';
import { AvailabilityProvider } from './ports/AvailabilityProvider';
import { PsychologistRepository } from './ports/PsychologistRepository';
import { ReviewReader } from './ports/ReviewReader';

/**
 * FR-02, FR-03. SRP: лише читання та фільтрація публічних даних психологів.
 * Не знає про бронювання чи оплату — працює через порти.
 */
export class CatalogService {
  constructor(
    private readonly psychologists: PsychologistRepository,
    private readonly availability: AvailabilityProvider,
    private readonly reviews: ReviewReader,
  ) {}

  async search(filter: PsychologistFilter = {}): Promise<PsychologistCard[]> {
    const all = await this.psychologists.findPublicPsychologists();
    const result: PsychologistCard[] = [];
    for (const p of all) {
      if (!this.matchesStatic(p, filter)) continue;
      if (filter.availableFrom || filter.availableTo) {
        const ok = await this.availability.hasOpenSlot(p.id, filter.availableFrom, filter.availableTo);
        if (!ok) continue;
      }
      result.push(this.toCard(p));
    }
    return result;
  }

  async getProfile(id: string): Promise<PsychologistProfileView> {
    const p = await this.psychologists.findPsychologistById(id);
    // Неверифіковані профілі не розкриваємо: для зовнішнього світу вони «не існують» (FR-01.2).
    if (!p || !p.isPublic) throw new NotFoundError('Психолога');
    const reviews = await this.reviews.findByPsychologist(id);
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
    return {
      ...this.toCard(p),
      bio: p.profile.bio,
      education: p.profile.education,
      diplomaCount: p.profile.diplomaFileKeys.length,
      certificateCount: p.profile.certificateFileKeys.length,
      reviews,
      averageRating: avg === null ? null : Math.round(avg * 10) / 10,
    };
  }

  private matchesStatic(p: Psychologist, f: PsychologistFilter): boolean {
    const { specializations, pricePerSession } = p.profile;
    if (f.specialization) {
      const needle = f.specialization.toLowerCase();
      if (!specializations.some((s) => s.toLowerCase() === needle)) return false;
    }
    if (f.minPrice !== undefined && pricePerSession < f.minPrice) return false;
    if (f.maxPrice !== undefined && pricePerSession > f.maxPrice) return false;
    return true;
  }

  private toCard(p: Psychologist): PsychologistCard {
    const pr = p.profile;
    return {
      id: p.id,
      fullName: pr.fullName,
      specializations: pr.specializations,
      methods: pr.methods,
      languages: pr.languages,
      experienceYears: pr.experienceYears,
      pricePerSession: pr.pricePerSession,
      sessionDurationMin: pr.sessionDurationMin,
      photoKey: pr.photoKey,
    };
  }
}
