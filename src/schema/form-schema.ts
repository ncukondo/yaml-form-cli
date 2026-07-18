import { z } from "zod";
import type { MessageKey } from "../messages.ts";

export const ITEM_TYPES = [
	"constant",
	"short_text",
	"long_text",
	"choice",
	"choice_table",
	"rubric",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

const choiceSchema = z
	.union([
		z.string().min(1),
		z.strictObject({
			title: z.string().min(1),
			value: z.string().min(1).optional(),
		}),
	])
	.transform((c) =>
		typeof c === "string"
			? { title: c, value: c }
			: { title: c.title, value: c.value ?? c.title },
	);

const tableRowSchema = z
	.union([
		z.string().min(1),
		z.strictObject({
			title: z.string().min(1),
			id: z.string().min(1).optional(),
		}),
	])
	.transform((r) =>
		typeof r === "string"
			? { key: r, title: r }
			: { key: r.id ?? r.title, title: r.title },
	);

const rubricRowSchema = z
	.strictObject({
		id: z.string().min(1).optional(),
		title: z.string().min(1),
		descriptors: z.array(z.string()).min(1),
	})
	.transform((r) => ({
		key: r.id ?? r.title,
		title: r.title,
		descriptors: r.descriptors,
	}));

const commonItemFields = {
	title: z.string().min(1),
	id: z.string().min(1),
	description: z.string().optional(),
	required: z.boolean().default(false),
	visible_when: z.string().optional(),
};

const constantItemSchema = z.strictObject({
	type: z.literal("constant"),
	...commonItemFields,
	value: z.string(),
});

// Text-like single-line input types only (decision 0011): they keep the
// free-text answer shape. Widget-changing types (date, color, …) would be
// their own item types; password is out because answers are submitted in
// plain text.
export const INPUT_TYPES = ["email", "tel", "url", "number"] as const;

const shortTextItemSchema = z.strictObject({
	type: z.literal("short_text").default("short_text"),
	...commonItemFields,
	input_type: z.enum(INPUT_TYPES).optional(),
	// Free-form: the HTML autocomplete token list is open-ended and allows
	// space-separated combinations; browsers ignore unknown tokens.
	autocomplete: z.string().min(1).optional(),
});

const longTextItemSchema = z.strictObject({
	type: z.literal("long_text"),
	...commonItemFields,
});

const choiceItemSchema = z.strictObject({
	type: z.literal("choice"),
	...commonItemFields,
	choices: z.array(choiceSchema).min(1),
	multiple: z.boolean().default(false),
});

const choiceTableItemSchema = z.strictObject({
	type: z.literal("choice_table"),
	...commonItemFields,
	items: z.array(tableRowSchema).min(1),
	choices: z.array(choiceSchema).min(1),
	multiple: z.boolean().default(false),
});

const rubricItemSchema = z.strictObject({
	type: z.literal("rubric"),
	...commonItemFields,
	items: z.array(rubricRowSchema).min(1),
	choices: z.array(choiceSchema).min(1),
	comment_per_row: z.boolean().default(false),
});

const itemSchema = z.discriminatedUnion("type", [
	constantItemSchema,
	shortTextItemSchema,
	longTextItemSchema,
	choiceItemSchema,
	choiceTableItemSchema,
	rubricItemSchema,
]);

const actionSchema = z.discriminatedUnion("type", [
	z.strictObject({ type: z.literal("log") }),
	z.strictObject({ type: z.literal("post"), url: z.url() }),
	z.strictObject({
		type: z.literal("mailto"),
		to: z.string().min(1),
		subject: z.string().optional(),
	}),
]);

const messageOverride = z.string().min(1).optional();

// `satisfies` keeps this literal in lockstep with MESSAGE_KEYS in
// src/messages.ts; strictObject makes a typo'd key a parse error.
const messagesSchema = z.strictObject({
	required: messageOverride,
	required_row: messageOverride,
	required_legend: messageOverride,
	submit: messageOverride,
	submitting: messageOverride,
	submit_failed: messageOverride,
	submit_success: messageOverride,
	comment: messageOverride,
	noscript_warning: messageOverride,
	clear_selection: messageOverride,
} satisfies Record<MessageKey, typeof messageOverride>);

export const formSchema = z
	.strictObject({
		title: z.string().min(1),
		lang: z
			.string()
			.regex(
				/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/,
				'Expected a BCP 47 language tag like "en" or "ja-JP"',
			)
			.default("en"),
		messages: messagesSchema.optional(),
		id: z.string().min(1).optional(),
		version: z.string().min(1).optional(),
		description: z.string().optional(),
		actions: z.union([z.array(actionSchema), actionSchema]).optional(),
		post_submit: z.strictObject({ message: z.string().optional() }).optional(),
		items: z.array(itemSchema).min(1),
	})
	.transform((f) => ({
		...f,
		actions:
			f.actions === undefined
				? []
				: Array.isArray(f.actions)
					? f.actions
					: [f.actions],
	}));

export type Form = z.output<typeof formSchema>;
export type FormItem = Form["items"][number];
export type ConstantItem = Extract<FormItem, { type: "constant" }>;
export type ShortTextItem = Extract<FormItem, { type: "short_text" }>;
export type LongTextItem = Extract<FormItem, { type: "long_text" }>;
export type ChoiceItem = Extract<FormItem, { type: "choice" }>;
export type ChoiceTableItem = Extract<FormItem, { type: "choice_table" }>;
export type RubricItem = Extract<FormItem, { type: "rubric" }>;
export type Action = Form["actions"][number];
export type Choice = ChoiceItem["choices"][number];
