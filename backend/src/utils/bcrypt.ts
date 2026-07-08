import bcrypt from 'bcrypt';

const DEFAULT_SALT_ROUNDS = 12;
const MIN_SALT_ROUNDS = 4;
const MAX_SALT_ROUNDS = 31;

const resolveSaltRounds = (): number => {
  const raw = process.env.BCRYPT_SALT_ROUNDS;
  if (!raw) return DEFAULT_SALT_ROUNDS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SALT_ROUNDS;
  if (parsed < MIN_SALT_ROUNDS || parsed > MAX_SALT_ROUNDS) return DEFAULT_SALT_ROUNDS;

  return parsed;
};

export const hashPassword = async (plainPassword: string, saltRounds = resolveSaltRounds()): Promise<string> => {
  if (!plainPassword) {
    throw new Error('Password is required for hashing.');
  }

  return bcrypt.hash(plainPassword, saltRounds);
};


export const verifyPassword = async (plainPassword: string, passwordHash: string): Promise<boolean> => {
  if (!plainPassword || !passwordHash) {
    return false;
  }

  return bcrypt.compare(plainPassword, passwordHash);
};
