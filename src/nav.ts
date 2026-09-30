import { getCollection } from 'astro:content';

// หมวดของบทเรียน = โฟลเดอร์ใน src/content/docs
export const sections = [
	{ dir: 'fundamentals', label: 'พื้นฐานทุกตำแหน่ง' },
	{ dir: 'pos1-carry', label: 'Pos 1 · Carry' },
	{ dir: 'pos2-mid', label: 'Pos 2 · Mid' },
	{ dir: 'pos3-offlane', label: 'Pos 3 · Offlane' },
	{ dir: 'pos4-soft', label: 'Pos 4 · Soft Support' },
	{ dir: 'pos5-hard', label: 'Pos 5 · Hard Support' },
];

export async function getNav() {
	const all = await getCollection('docs');
	return sections.map((s) => ({
		...s,
		items: all
			.filter((e) => e.id.startsWith(`${s.dir}/`))
			.sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id)),
	}));
}
