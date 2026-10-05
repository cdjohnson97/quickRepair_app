// Chiffre / déchiffre server/.env avec dotenvx.
//   npm run env:encrypt  -> .env (clair, ignoré par git) => .env.encrypted (chiffré, commité)
//   npm run env:decrypt  -> .env.encrypted + .env.keys    => .env
// La clé privée reste dans .env.keys (ignoré par git) : à garder dans un gestionnaire de mots de passe.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const PLAIN = '.env';
const ENCRYPTED = '.env.encrypted';
const OPTS = '--no-armor --no-native --no-1password --no-bitwarden';

const mode = process.argv[2];

if (mode === 'encrypt') {
  // Reprend la clé publique existante pour que dotenvx réutilise la même paire de clés.
  const header = existsSync(ENCRYPTED)
    ? readFileSync(ENCRYPTED, 'utf8').split(/\r?\n/).filter((l) => l.startsWith('DOTENV_PUBLIC_KEY')).join('\n')
    : '';
  writeFileSync(ENCRYPTED, (header ? header + '\n\n' : '') + readFileSync(PLAIN, 'utf8'));
  execSync(`npx dotenvx encrypt -f ${ENCRYPTED} ${OPTS}`, { stdio: 'inherit' });
} else if (mode === 'decrypt') {
  // --stdout puis écriture seulement en cas de succès : un échec ne vide jamais .env.
  const out = execSync(`npx dotenvx decrypt -f ${ENCRYPTED} --stdout --no-armor --no-native`, { encoding: 'utf8' });
  const lines = out.split(/\r?\n/).filter((l) => !l.startsWith('DOTENV_PUBLIC_KEY') && !l.startsWith('#/'));
  writeFileSync(PLAIN, lines.join('\n').trim() + '\n');
  console.log(`${PLAIN} restauré depuis ${ENCRYPTED}`);
} else {
  console.error('Usage : node scripts/env.mjs encrypt|decrypt');
  process.exit(1);
}
