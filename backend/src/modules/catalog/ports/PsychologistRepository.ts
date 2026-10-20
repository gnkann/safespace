import { VerificationStatus } from '../../../shared/domain/enums';
import { Psychologist } from '../../auth/domain/Psychologist';

/** Порт читання психологів для каталогу, бронювання та адміністрування. */
export interface PsychologistRepository {
  findPsychologistById(id: string): Promise<Psychologist | null>;
  /** Лише верифіковані та активні (FR-02). */
  findPublicPsychologists(): Promise<Psychologist[]>;
  findPsychologistsByVerification(status: VerificationStatus): Promise<Psychologist[]>;
}
