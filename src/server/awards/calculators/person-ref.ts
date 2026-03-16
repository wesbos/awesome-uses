import type { Person } from '../../../lib/types';
import { getAvatarUrl } from '../../../lib/avatar';
import type { PersonRef } from '../types';

export function toPersonRef(person: Person): PersonRef {
  return {
    personSlug: person.personSlug,
    name: person.name,
    avatarUrl: getAvatarUrl(person),
  };
}

export function toPersonRefWithGithub(person: Person): PersonRef & { github: string } {
  return {
    ...toPersonRef(person),
    github: person.github ?? '',
  };
}

export const EMPTY_PERSON_REF: PersonRef = {
  personSlug: '',
  name: '',
  avatarUrl: '',
};
