// UI-string table shared by the generator (Node) and the browser runtime
// (bundled into the generated HTML). Keep this module dependency-free; the
// runtime resolves messages from the embedded form JSON via resolveMessages.
// See decisions/0010-i18n.md for the schema surface and precedence rules.

export const MESSAGE_KEYS = [
	"required",
	"required_row",
	"required_legend",
	"submit",
	"submitting",
	"submit_failed",
	"submit_success",
	"comment",
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];
export type Messages = Record<MessageKey, string>;
export type MessageOverrides = Partial<Messages>;

export const BUILTIN_MESSAGES: Record<"en" | "ja", Messages> = {
	en: {
		required: '"{title}" is required.',
		required_row: '"{row}" in "{title}" is required.',
		required_legend: "{mark} indicates required",
		submit: "Submit",
		submitting: "Submitting…",
		submit_failed: "Submission failed. Please try again.",
		submit_success: "Your response has been submitted.",
		comment: "Comment — {row}",
	},
	ja: {
		required: "「{title}」は必須です。",
		required_row: "「{title}」の「{row}」は必須です。",
		required_legend: "{mark} は必須項目です",
		submit: "送信",
		submitting: "送信中…",
		submit_failed: "送信に失敗しました。もう一度お試しください。",
		submit_success: "回答を送信しました。",
		comment: "コメント — {row}",
	},
};

export const DEFAULT_LANG = "en";

function builtinFor(lang: string): Messages {
	// "ja-JP" selects the "ja" bundle; unknown primary tags fall back to en.
	const primary = lang.split("-")[0]?.toLowerCase();
	return primary !== undefined && primary in BUILTIN_MESSAGES
		? BUILTIN_MESSAGES[primary as keyof typeof BUILTIN_MESSAGES]
		: BUILTIN_MESSAGES.en;
}

export function resolveMessages(form: {
	lang?: string;
	messages?: MessageOverrides;
}): Messages {
	return { ...builtinFor(form.lang ?? DEFAULT_LANG), ...form.messages };
}

/** Fill `{name}` placeholders; unknown placeholders are left literal. */
export function formatMessage(
	template: string,
	params: Record<string, string>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		Object.hasOwn(params, key) ? (params[key] as string) : match,
	);
}
