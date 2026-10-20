import { SessionStatus } from '../../shared/domain/enums';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { newId } from '../../shared/id';
import { Clock } from '../../shared/time/Clock';
import { UserRepository } from '../auth/ports/UserRepository';
import { Client } from '../auth/domain/Client';
import { PublicReview, ReviewReader } from '../catalog/ports/ReviewReader';
import { Review } from './domain/Review';
import { ReviewRepository, SessionRepository } from './ports/repositories';

/** Відгуки клієнтів. Реалізує порт ReviewReader для каталогу (FR-03). */
export class ReviewService implements ReviewReader {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async leaveReview(clientId: string, sessionId: string, rating: number, text: string): Promise<Review> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError('Сесію');
    if (session.clientId !== clientId) throw new ForbiddenError();
    if (session.status !== SessionStatus.COMPLETED) throw new ConflictError('Відгук можна залишити лише після завершення сесії');
    if (await this.reviews.findBySession(sessionId)) throw new ConflictError('Відгук для цієї сесії вже існує');

    const review = new Review(newId(), sessionId, clientId, session.psychologistId, rating, text ?? '', this.clock.now());
    await this.reviews.save(review);
    return review;
  }

  async findByPsychologist(psychologistId: string): Promise<PublicReview[]> {
    const items = await this.reviews.findByPsychologist(psychologistId);
    const result: PublicReview[] = [];
    for (const r of items) {
      const author = await this.users.findById(r.clientId);
      // Автор відображається лише за псевдонімом (NFR-04).
      result.push({
        rating: r.rating,
        text: r.text,
        authorPseudonym: author instanceof Client ? author.pseudonym : 'Анонім',
        createdAt: r.createdAt,
      });
    }
    return result;
  }
}
