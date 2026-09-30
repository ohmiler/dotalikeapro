// ค่าสองตัวนี้ถูกอัปเดตอัตโนมัติโดย scripts/check-patch.mjs (GitHub Action) — ไม่ต้องแก้มือ
//
// LATEST_PATCH    = patch ล่าสุดที่ Valve ปล่อยแล้ว
// MECHANICS_PATCH = patch ล่าสุดที่ "เปลี่ยนกฎเกม" (แผนที่ objective ป่า ครีป) ตามแพตช์โน้ตทางการ
//
// บทเรียนที่ evergreen: false จะขึ้นป้าย "อาจล้าสมัย" เมื่อ frontmatter `patch` เก่ากว่า MECHANICS_PATCH
// พอตรวจบทแล้ว ให้แก้ `patch` ในบทนั้นเป็นค่า MECHANICS_PATCH ป้ายจะหาย
export const LATEST_PATCH = '7.41f';
export const MECHANICS_PATCH = '7.41e';

/** เทียบเลข patch เช่น 7.41 < 7.41a < 7.41b < 7.42 (คืนค่าลบ/0/บวก) */
export function comparePatch(a: string, b: string): number {
	const parse = (v: string) => {
		const m = /^(\d+)\.(\d+)([a-z]?)$/.exec(v.trim());
		if (!m) return null;
		return [Number(m[1]), Number(m[2]), m[3] ? m[3].charCodeAt(0) - 96 : 0];
	};
	const pa = parse(a);
	const pb = parse(b);
	if (!pa || !pb) return pa ? 1 : pb ? -1 : 0; // ค่าที่อ่านไม่ได้ ถือว่าเก่ากว่า
	for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
	return 0;
}
