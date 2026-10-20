export interface PublicReview {
  rating: number;
  text: string;
  authorPseudonym: string;
  createdAt: Date;
}

/** Порт читання відгуків для профілю психолога (FR-03). Реалізується модулем booking. */
export interface ReviewReader {
  findByPsychologist(psychologistId: string): Promise<PublicReview[]>;
}
