// In-memory rate limiter — good enough for a single-user app on one server
// instance. Would need a shared store (e.g. Redis) behind multiple instances.

const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

export function isRateLimited(key: string): boolean {
	const now = Date.now();
	const entry = attempts.get(key);

	if (!entry || now > entry.resetAt) {
		attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
		return false;
	}

	entry.count += 1;
	return entry.count > MAX_ATTEMPTS;
}
