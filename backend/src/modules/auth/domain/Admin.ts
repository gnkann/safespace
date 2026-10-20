import { Role } from '../../../shared/domain/enums';
import { User, UserProps } from './User';

/** Адміністратор платформи. Дії адміністратора журналюються (NFR-08) модулем admin. */
export class Admin extends User {
  constructor(props: UserProps) {
    super(props);
  }

  get role(): Role {
    return Role.ADMIN;
  }
}
