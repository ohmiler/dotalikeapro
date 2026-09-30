import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const collections = {
	docs: defineCollection({
		loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
		schema: z.object({
			title: z.string(),
			description: z.string().optional(),
			// ลำดับในหมวด (น้อยขึ้นก่อน) ถ้าไม่ระบุจะเรียงตามชื่อไฟล์
			order: z.number().default(99),
			// true = หลักการที่ใช้ได้ทุกยุค, false = ขึ้นกับ patch
			evergreen: z.boolean().default(true),
			// patch ที่เนื้อหานี้ตรวจสอบล่าสุด (ระบุเมื่อ evergreen: false)
			patch: z.string().optional(),
			lastReviewed: z.coerce.date().optional(),
		}),
	}),
};
