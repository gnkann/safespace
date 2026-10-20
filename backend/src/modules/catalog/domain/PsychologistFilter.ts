/** Критерії пошуку в каталозі (FR-02). */
export interface PsychologistFilter {
  specialization?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Психолог має хоча б один вільний слот у вказаному інтервалі. */
  availableFrom?: Date;
  availableTo?: Date;
}

export interface PsychologistCard {
  id: string;
  fullName: string;
  specializations: string[];
  methods: string[];
  languages: string[];
  experienceYears: number;
  pricePerSession: number;
  sessionDurationMin: number;
  photoKey?: string;
}

export interface PsychologistProfileView extends PsychologistCard {
  bio?: string;
  education: Array<{ institution: string; specialty: string; graduationYear: number }>;
  diplomaCount: number;
  certificateCount: number;
  reviews: Array<{ rating: number; text: string; authorPseudonym: string; createdAt: Date }>;
  averageRating: number | null;
}
