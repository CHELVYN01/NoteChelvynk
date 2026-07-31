import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPin(pin: string): string {
	const salt = randomBytes(16).toString('hex');
	const derived = scryptSync(pin, salt, KEY_LENGTH).toString('hex');
	return `${salt}:${derived}`;
}

export function verifyPin(pin: string, hash: string): boolean {
	const [salt, storedHex] = hash.split(':');
	if (!salt || !storedHex) return false;

	const stored = Buffer.from(storedHex, 'hex');
	const derived = scryptSync(pin, salt, KEY_LENGTH);

	// timingSafeEqual throws if lengths differ instead of returning false —
	// a malformed/foreign hash must not crash the request.
	if (stored.length !== derived.length) return false;

	return timingSafeEqual(stored, derived);
}
