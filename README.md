# dotalikeapro

เว็บสอนเล่น Dota 2 แบบผู้เล่นระดับ Immortal ครอบคลุมพื้นฐานทุกตำแหน่ง (Pos 1–5) สร้างด้วย [Astro](https://astro.build)

> ไม่ใช่เว็บทางการของ Valve ภาพและชื่อที่เกี่ยวกับ Dota 2 เป็นลิขสิทธิ์ของ Valve

## เริ่มใช้งาน

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # สร้างเว็บใน dist/
```

## โครงสร้าง

| ที่ | คืออะไร |
| --- | --- |
| `src/pages/index.astro` | หน้าแรก |
| `src/pages/[...slug].astro` | หน้าบทเรียน (สร้างจาก `src/content/docs`) |
| `src/content/docs/<หมวด>/<บท>.md` | เนื้อหาบทเรียน |
| `src/layouts/` | เลย์เอาต์หลัก (`Home`) และบทเรียน (`Lesson`) |
| `src/styles/` | `home.css` (หน้าแรก) และ `prose.css` (บทเรียน) |
| `src/patch.ts` | patch ปัจจุบันของเกม บทที่ล้าสมัยจะขึ้นป้ายเตือนเอง |

ก่อนแก้ UI หรือเพิ่มบทเรียน อ่าน [DESIGN.md](./DESIGN.md) (สี ฟอนต์ ระยะห่าง และวิธีเขียนบทเรียน)
