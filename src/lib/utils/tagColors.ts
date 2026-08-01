export const TAG_COLORS = ['gray', 'red', 'amber', 'green', 'blue', 'purple', 'pink'] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export function isTagColor(value: string): value is TagColor {
	return (TAG_COLORS as readonly string[]).includes(value);
}

// Tailwind class names must appear as complete string literals in source for
// the JIT compiler to find them via content scanning — building them with
// template strings (`bg-${color}-100`) would silently produce no styles.
const CHIP_CLASSES: Record<TagColor, string> = {
	gray: 'bg-gray-100 text-gray-700',
	red: 'bg-red-100 text-red-700',
	amber: 'bg-amber-100 text-amber-700',
	green: 'bg-green-100 text-green-700',
	blue: 'bg-blue-100 text-blue-700',
	purple: 'bg-purple-100 text-purple-700',
	pink: 'bg-pink-100 text-pink-700'
};

const SWATCH_CLASSES: Record<TagColor, string> = {
	gray: 'bg-gray-400',
	red: 'bg-red-400',
	amber: 'bg-amber-400',
	green: 'bg-green-400',
	blue: 'bg-blue-400',
	purple: 'bg-purple-400',
	pink: 'bg-pink-400'
};

export function tagChipClass(color: string): string {
	return CHIP_CLASSES[isTagColor(color) ? color : 'gray'];
}

export function tagSwatchClass(color: string): string {
	return SWATCH_CLASSES[isTagColor(color) ? color : 'gray'];
}
