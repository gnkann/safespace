import { AccountStatus, Role, VerificationStatus } from '../../../shared/domain/enums';
import { ConflictError } from '../../../shared/errors';
import { User, UserProps } from './User';

export interface PsychologistProfile {
  fullName: string;
  phone: string;
  education: Array<{ institution: string; specialty: string; graduationYear: number }>;
  /** Ключі файлів дипломів у файловому сховищі (S3); самі файли шифруються (NFR-03). */
  diplomaFileKeys: string[];
  certificateFileKeys: string[];
  experienceYears: number;
  specializations: string[];
  methods: string[];
  languages: string[];
  pricePerSession: number;
  sessionDurationMin: number;
  bio?: string;
  photoKey?: string;
}

export interface PsychologistProps extends UserProps {
  profile: PsychologistProfile;
  verificationStatus?: VerificationStatus;
  consentAcceptedAt: Date;
}

export class Psychologist extends User {
  private _profile: PsychologistProfile;
  private _verification: VerificationStatus;
  readonly consentAcceptedAt: Date;

  constructor(props: PsychologistProps) {
    super(props);
    this._profile = props.profile;
    this._verification = props.verificationStatus ?? VerificationStatus.PENDING;
    this.consentAcceptedAt = props.consentAcceptedAt;
  }

  get role(): Role {
    return Role.PSYCHOLOGIST;
  }

  get profile(): PsychologistProfile {
    return this._profile;
  }

  get verificationStatus(): VerificationStatus {
    return this._verification;
  }

  /**
   * Психолог видимий у каталозі й приймає бронювання лише після верифікації
   * адміністратором та за активного облікового запису (FR-01.2, FR-10).
   */
  get isPublic(): boolean {
    return this._verification === VerificationStatus.VERIFIED && this.status === AccountStatus.ACTIVE;
  }

  updateProfile(patch: Partial<PsychologistProfile>): void {
    this._profile = { ...this._profile, ...patch };
    // Після редагування дипломів анкету потрібно перевірити повторно.
    if (patch.diplomaFileKeys || patch.education) this._verification = VerificationStatus.PENDING;
  }

  verify(): void {
    if (this._verification === VerificationStatus.VERIFIED) {
      throw new ConflictError('Анкету вже підтверджено');
    }
    this._verification = VerificationStatus.VERIFIED;
  }

  reject(): void {
    this._verification = VerificationStatus.REJECTED;
  }
}
