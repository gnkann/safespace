import { Role } from '../../../shared/domain/enums';
import { User, UserProps } from './User';

export interface ClientProps extends UserProps {
  /** Псевдонім відображається замість реального імені (NFR-04). */
  pseudonym: string;
  realName?: string;
  phone?: string;
  /** Момент надання згоди з умовами використання та політикою конфіденційності (FR-01.1, NFR-07). */
  consentAcceptedAt: Date;
}

export class Client extends User {
  readonly pseudonym: string;
  readonly realName?: string;
  readonly phone?: string;
  readonly consentAcceptedAt: Date;

  constructor(props: ClientProps) {
    super(props);
    this.pseudonym = props.pseudonym;
    this.realName = props.realName;
    this.phone = props.phone;
    this.consentAcceptedAt = props.consentAcceptedAt;
  }

  get role(): Role {
    return Role.CLIENT;
  }

  /** Публічне представлення — без реального імені, телефону та email (NFR-04). */
  toPublic(): { id: string; pseudonym: string } {
    return { id: this.id, pseudonym: this.pseudonym };
  }
}
