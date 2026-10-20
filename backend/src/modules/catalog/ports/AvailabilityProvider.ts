/**
 * Порт, який каталог використовує, щоб дізнатися про вільні слоти.
 * Реалізується модулем booking (DIP): catalog не імпортує код booking напряму.
 */
export interface AvailabilityProvider {
  hasOpenSlot(psychologistId: string, from?: Date, to?: Date): Promise<boolean>;
}
