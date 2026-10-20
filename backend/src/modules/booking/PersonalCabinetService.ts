import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { newId } from '../../shared/id';
import { Encryptor } from '../../shared/security/Encryptor';
import { Clock } from '../../shared/time/Clock';
import { PersonalNote } from './domain/PersonalNote';
import { NoteRepository } from './ports/repositories';

export interface NoteView {
  id: string;
  content: string;
  createdAt: Date;
}

/**
 * FR-09: особисті нотатки клієнта. Вміст шифрується на рівні застосунку (NFR-03)
 * і доступний лише власнику (NFR-04). Базові рекомендації — статичні ресурси (поза скелетом).
 */
export class PersonalCabinetService {
  constructor(
    private readonly notes: NoteRepository,
    private readonly encryptor: Encryptor,
    private readonly clock: Clock,
  ) {}

  async addNote(clientId: string, content: string): Promise<NoteView> {
    if (!content || content.trim().length === 0) throw new ValidationError('Нотатка не може бути порожньою');
    const note = new PersonalNote(newId(), clientId, this.encryptor.encrypt(content), this.clock.now());
    await this.notes.save(note);
    return { id: note.id, content, createdAt: note.createdAt };
  }

  async listNotes(clientId: string): Promise<NoteView[]> {
    const items = await this.notes.findByClient(clientId);
    return items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((n) => ({ id: n.id, content: this.encryptor.decrypt(n.encryptedContent), createdAt: n.createdAt }));
  }

  async deleteNote(clientId: string, noteId: string): Promise<void> {
    const note = await this.notes.findById(noteId);
    if (!note) throw new NotFoundError('Нотатку');
    if (note.clientId !== clientId) throw new ForbiddenError();
    await this.notes.delete(noteId);
  }
}
