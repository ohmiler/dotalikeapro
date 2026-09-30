// ตรวจ patch ใหม่ของ Dota 2 จากแพตช์โน้ตทางการของ Valve แล้วอัปเดต src/patch.ts
//
//   node scripts/check-patch.mjs              ตรวจและแก้ src/patch.ts
//   node scripts/check-patch.mjs --dry        ตรวจอย่างเดียว ไม่แก้ไฟล์
//   node scripts/check-patch.mjs --from=7.41b --mech-from=7.41b   จำลองว่ารู้ล่าสุดแค่ 7.41b (ใช้ทดสอบกับ --dry)
//
// ผลลัพธ์:
//   - แก้ LATEST_PATCH ทุกครั้งที่มี patch ใหม่
//   - แก้ MECHANICS_PATCH เมื่อ patch ใหม่เปลี่ยนกฎเกมที่เกี่ยวกับบทเรียน (general_notes/neutral_creeps ที่ตรงกับ KEYWORDS)
//   - เขียนรายงานเป็น Markdown ที่ patch-report.md และส่งค่าไป $GITHUB_OUTPUT (ถ้ารันใน GitHub Actions)
//
// ถ้าดึงข้อมูลไม่ได้หรือรูปแบบข้อมูลเปลี่ยน สคริปต์จะ exit ด้วย error เพื่อให้ Action ล้มและแจ้งเตือน (ไม่เงียบ)

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const PATCH_FILE = 'src/patch.ts';
const REPORT_FILE = process.env.REPORT_PATH ?? 'patch-report.md';
const FEED = 'https://www.dota2.com/datafeed';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (dotalikeapro patch checker)' };

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const argValue = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const fromArg = argValue('--from');
const mechFromArg = argValue('--mech-from');

// คำที่บอกว่าข้อความในแพตช์โน้ตเกี่ยวกับสิ่งที่บทเรียนของเราพูดถึง (objective ป่า ครีป ทรัพยากร แผนที่)
// ตั้งใจให้กว้างไว้ก่อน: พลาดการเปลี่ยนที่เกี่ยว (บทล้าสมัยโดยไม่เตือน) แย่กว่าเตือนเกินหนึ่งครั้ง
// แก้ไขรายการนี้ได้เมื่อเพิ่มบทที่พูดถึงเรื่องใหม่
const KEYWORDS =
	/rune|roshan|aegis|tormentor|shard|neutral|camp|wisdom|lotus|shrine|creep|siege|bounty|ward|watcher|lane|facet|innate|experience|gold|tower|outpost|twin gate|courier|night|daytime|stack|pull/i;

async function getJson(url) {
	const res = await fetch(url, { headers: HEADERS });
	if (!res.ok) throw new Error(`ดึงข้อมูลไม่สำเร็จ ${url} → HTTP ${res.status}`);
	const json = await res.json();
	if (json.success === false) throw new Error(`Valve ตอบ success:false จาก ${url}`);
	return json;
}

/** ดึงข้อความ "note" ทั้งหมดจากโครงสร้างแพตช์โน้ต (ซ้อนกันหลายชั้น) */
function collectNotes(node, out = []) {
	if (Array.isArray(node)) node.forEach((n) => collectNotes(n, out));
	else if (node && typeof node === 'object') {
		if (typeof node.note === 'string') {
			const text = node.note.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
			if (text) out.push(text);
		}
		for (const [k, v] of Object.entries(node)) {
			if (k !== 'note' && v && typeof v === 'object') collectNotes(v, out);
		}
	}
	return out;
}

const readConst = (src, name) => {
	const m = src.match(new RegExp(`export const ${name} = '([^']+)'`));
	if (!m) throw new Error(`ไม่พบ ${name} ใน ${PATCH_FILE}`);
	return m[1];
};

function setConst(src, name, value) {
	return src.replace(new RegExp(`(export const ${name} = ')[^']+(')`), `$1${value}$2`);
}

function setOutput(key, value) {
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

// ---------- main ----------

const src = readFileSync(PATCH_FILE, 'utf8');
const knownLatest = fromArg ?? readConst(src, 'LATEST_PATCH');
const knownMechanics = mechFromArg ?? readConst(src, 'MECHANICS_PATCH');

const listJson = await getJson(`${FEED}/patchnoteslist?language=english`);
const patches = listJson.patches;
if (!Array.isArray(patches) || patches.length === 0 || !patches.every((p) => p.patch_number && p.patch_timestamp)) {
	throw new Error('รูปแบบรายการ patch ไม่ตรงที่คาดไว้ (Valve อาจเปลี่ยน API) ต้องตรวจสคริปต์');
}
patches.sort((a, b) => a.patch_timestamp - b.patch_timestamp);

const idx = patches.findIndex((p) => p.patch_number === knownLatest);
if (idx === -1) throw new Error(`ไม่พบ patch ${knownLatest} ในรายการของ Valve`);

const fresh = patches.slice(idx + 1);
const latest = patches.at(-1).patch_number;

if (fresh.length === 0) {
	console.log(`ไม่มี patch ใหม่ (ล่าสุด ${latest})`);
	setOutput('changed', 'false');
	setOutput('mechanics', 'false');
} else {
	await handleFresh();
}

async function handleFresh() {
const reports = [];
let newMechanics = knownMechanics;

for (const p of fresh) {
	const notes = await getJson(`${FEED}/patchnotes?version=${encodeURIComponent(p.patch_number)}&language=english`);
	// patch ที่ไม่แตะเรื่องไหนจะไม่มีหัวข้อนั้นเลย (เช่น 7.41f ไม่มี general_notes) ถือเป็นว่าง
	// แต่ถ้าไม่เจอหัวข้อที่รู้จักสักอัน แปลว่ารูปแบบข้อมูลเปลี่ยน
	const known = ['general_notes', 'neutral_creeps', 'items', 'neutral_items', 'heroes'];
	if (!known.some((k) => k in notes)) {
		throw new Error(`แพตช์โน้ต ${p.patch_number} มีโครงสร้างไม่ตรงที่คาดไว้ ต้องตรวจสคริปต์`);
	}
	const general = collectNotes(notes.general_notes);
	const neutral = collectNotes(notes.neutral_creeps);
	const relevant = [...general, ...neutral].filter((t) => KEYWORDS.test(t));
	// กระทบบทเรียนเฉพาะเมื่อมีข้อความที่เกี่ยวกับเรื่องที่เราสอน (การเปลี่ยนกฎอื่น เช่น รัศมีออร่า Fountain ไม่นับ)
	const changesRules = relevant.length > 0;
	if (changesRules) newMechanics = p.patch_number;

	reports.push({
		patch: p.patch_number,
		date: new Date(p.patch_timestamp * 1000).toISOString().slice(0, 10),
		changesRules,
		general,
		neutral,
		relevant,
		counts: {
			heroes: (notes.heroes ?? []).length,
			items: (notes.items ?? []).length,
			neutralItems: (notes.neutral_items ?? []).length,
		},
	});
}

const mechanicsChanged = newMechanics !== knownMechanics;

// ---------- รายงาน ----------
const lines = [];
lines.push(`# Patch ใหม่: ${knownLatest} → ${latest}`, '');
lines.push(
	mechanicsChanged
		? `**กฎเกมที่เกี่ยวกับบทเรียนเปลี่ยน** (ล่าสุดที่ ${newMechanics}) — บทเรียนที่ตั้งเป็น \`evergreen: false\` และ \`patch\` เก่ากว่านี้จะขึ้นป้าย "อาจล้าสมัย" แล้ว ต้องตรวจทีละบท`
		: '**ไม่มีการเปลี่ยนที่เกี่ยวกับบทเรียน** (มีแต่ฮีโร่/ไอเท็ม หรือกฎเล็กน้อยที่ไม่เกี่ยว) บทเรียนไม่ต้องแก้ ป้ายไม่เปลี่ยน',
	'',
);
for (const r of reports) {
	lines.push(`## ${r.patch} (${r.date}) — ${r.changesRules ? 'กระทบบทเรียน' : r.general.length + r.neutral.length ? 'กฎเล็กน้อยที่ไม่เกี่ยวกับบทเรียน' : 'ฮีโร่/ไอเท็มเท่านั้น'}`, '');
	lines.push(`ฮีโร่ ${r.counts.heroes} · ไอเท็ม ${r.counts.items} · Neutral item ${r.counts.neutralItems}`, '');
	const show = r.relevant.length ? r.relevant : [...r.general, ...r.neutral];
	if (show.length) {
		lines.push(r.relevant.length ? '**ข้อที่น่าจะเกี่ยวกับบทเรียน:**' : '**ข้อความทั้งหมด:**', '');
		for (const t of show.slice(0, 40)) lines.push(`- ${t}`);
		if (show.length > 40) lines.push(`- … และอีก ${show.length - 40} ข้อ`);
		lines.push('');
	}
}
if (mechanicsChanged) {
	lines.push('## ขั้นตอนตรวจบทเรียน', '');
	lines.push('1. อ่านข้อความด้านบน แล้วเทียบกับบทที่ขึ้นกับ patch: `fundamentals/timings`, `fundamentals/creep-equilibrium`, `pos2-mid/rune-control`, `pos3-offlane/laning`, `pos4-soft/pull-and-stack`, `pos5-hard/warding`, `pos1-carry/farm-pattern`');
	lines.push('2. แก้เนื้อหาที่เปลี่ยน แล้วตั้ง `patch:` และ `lastReviewed:` ในบทนั้นให้เป็นค่าใหม่');
	lines.push(`3. ป้าย "อาจล้าสมัย" จะหายเมื่อ \`patch\` ของบท ≥ ${newMechanics}`, '');
	lines.push(`แหล่งข้อมูล: https://www.dota2.com/patches/${latest.replace(/[a-z]$/, '')}`);
}
writeFileSync(REPORT_FILE, lines.join('\n') + '\n');

// ---------- อัปเดตไฟล์ ----------
console.log(`patch ใหม่ ${fresh.length} รายการ: ${fresh.map((p) => p.patch_number).join(', ')}`);
console.log(`LATEST_PATCH: ${knownLatest} → ${latest}`);
console.log(`MECHANICS_PATCH: ${knownMechanics} → ${newMechanics}${mechanicsChanged ? ' (กระทบบทเรียน)' : ''}`);

if (dry) {
	console.log('--dry: ไม่แก้ไฟล์');
} else {
	let out = setConst(src, 'LATEST_PATCH', latest);
	out = setConst(out, 'MECHANICS_PATCH', newMechanics);
	writeFileSync(PATCH_FILE, out);
}

setOutput('changed', 'true');
setOutput('mechanics', String(mechanicsChanged));
setOutput('latest', latest);
setOutput('mechanics_patch', newMechanics);
console.log(`รายงาน: ${REPORT_FILE}`);
}
