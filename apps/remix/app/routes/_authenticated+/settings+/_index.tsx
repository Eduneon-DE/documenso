import { redirect } from 'react-router';

import { IS_COCKPIT_MODE } from '@documenso/lib/constants/app';

export function loader() {
  // In Cockpit mode, redirect to document preferences instead of profile
  const defaultRoute = IS_COCKPIT_MODE() ? '/settings/document' : '/settings/profile';
  throw redirect(defaultRoute);
}
