import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';

export function load() {
  return db.query('SELECT * FROM users');
}
