import { randomInt } from "node:crypto";

export function generateVerificationCode(length = 6): string {
  const minimum = 10 ** (length - 1);
  const maximum = 10 ** length;
  return String(randomInt(minimum, maximum));
}
