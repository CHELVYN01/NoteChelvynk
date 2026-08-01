export interface Note {
	id: string;
	user_id: string;
	title: string;
	content: string;
	is_pinned: boolean;
	is_archived: boolean;
	is_locked: boolean;
	pin_hash: string | null;
	created_at: string;
	updated_at: string;
}

export interface Tag {
	id: string;
	user_id: string;
	name: string;
	color: string;
	created_at: string;
}

export interface SearchResult {
	id: string;
	title: string;
	snippet: string;
	is_pinned: boolean;
	is_locked: boolean;
	updated_at: string;
}
