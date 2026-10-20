/** Особиста нотатка клієнта (FR-09). У сховищі `encryptedContent` завжди зашифрований (AES-256-GCM, NFR-03). */
export class PersonalNote {
  constructor(
    readonly id: string,
    readonly clientId: string,
    readonly encryptedContent: string,
    readonly createdAt: Date,
  ) {}
}
