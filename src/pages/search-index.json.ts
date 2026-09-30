import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sections } from '../nav';

// ดัชนีค้นหา: สร้างตอน build เป็นไฟล์ /search-index.json (โหลดครั้งแรกที่ผู้ใช้เปิดช่องค้นหา)
// ค้นด้วยการหาข้อความตรงๆ ฝั่งเบราว์เซอร์ ไม่พึ่งการตัดคำ จึงใช้กับภาษาไทยได้

/** ตัด syntax ของ Markdown ออกให้เหลือข้อความล้วน */
function plain(md: string): string {
	return md
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s*>\s?/gm, '')
		.replace(/^\s*\|?\s*:?-{3,}[\s|:-]*$/gm, ' ')
		.replace(/\|/g, ' ')
		.replace(/[*_~]{1,3}/g, '')
		.replace(/^\s*[-+]\s+/gm, '')
		.replace(/^\s*\d+\.\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export const GET: APIRoute = async () => {
	const entries = await getCollection('docs');
	const index = entries.map((e) => {
		const body = e.body ?? '';
		return {
			url: `/${e.id}/`,
			title: e.data.title,
			section: sections.find((s) => e.id.startsWith(`${s.dir}/`))?.label ?? '',
			headings: [...body.matchAll(/^\s{0,3}#{2,3}\s+(.+)$/gm)].map((m) => plain(m[1])),
			text: plain(body),
		};
	});
	return new Response(JSON.stringify(index), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
};
