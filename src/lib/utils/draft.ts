export interface NoteDraft {
	title: string;
	content: string;
	savedAt: string;
}

const keyFor = (noteId: string) => `notechelvyn:draft:${noteId}`;

export function saveDraft(noteId: string, title: string, content: string): void {
	const draft: NoteDraft = { title, content, savedAt: new Date().toISOString() };
	localStorage.setItem(keyFor(noteId), JSON.stringify(draft));
}

export function loadDraft(noteId: string): NoteDraft | null {
	const raw = localStorage.getItem(keyFor(noteId));
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw);
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			typeof parsed.title === 'string' &&
			typeof parsed.content === 'string' &&
			typeof parsed.savedAt === 'string'
		) {
			return parsed as NoteDraft;
		}
	} catch {
		// Corrupt or foreign value under this key — treat as no draft.
	}
	return null;
}

export function clearDraft(noteId: string): void {
	localStorage.removeItem(keyFor(noteId));
}
