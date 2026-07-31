export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number) {
	let timeout: ReturnType<typeof setTimeout>;

	function scheduled(...args: Args) {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delayMs);
	}

	scheduled.cancel = () => clearTimeout(timeout);

	return scheduled;
}
