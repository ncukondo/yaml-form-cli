// Submit actions (log / post / mailto). Actions share one run/report loop:
// each runner either completes or throws, and runActions turns that into the
// sequential stop-at-first-failure result.
import type { Action, Choice, Form } from "../schema/form-schema.ts";
import type { AnswerCell, SubmitAnswers, SubmitPayload } from "./submit.ts";

// The browser pieces an action touches, injectable for tests.
export interface ActionEnv {
	log: (...args: unknown[]) => void;
	fetch: (
		url: string,
		init: { method: string; headers: Record<string, string>; body: string },
	) => Promise<{ ok: boolean; status: number }>;
	openUrl: (url: string) => void;
}

export type ActionsResult = { ok: true } | { ok: false; message: string };

interface ActionRunContext {
	payload: SubmitPayload;
	form: Form;
	env: ActionEnv;
}

type ActionRunner<T extends Action["type"]> = (
	action: Extract<Action, { type: T }>,
	ctx: ActionRunContext,
) => void | Promise<void>;

const runners: { [T in Action["type"]]: ActionRunner<T> } = {
	log(_action, { payload, env }) {
		env.log(payload);
	},
	async post(action, { payload, env }) {
		const res = await env.fetch(action.url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			throw new Error(`POST ${action.url} responded with status ${res.status}`);
		}
	},
	mailto(action, { payload, form, env }) {
		env.openUrl(buildMailtoUrl(action, form, payload.answers));
	},
};

export async function runActions(
	actions: readonly Action[],
	payload: SubmitPayload,
	form: Form,
	env: ActionEnv,
): Promise<ActionsResult> {
	for (const action of actions) {
		try {
			const run = runners[action.type] as ActionRunner<Action["type"]>;
			await run(action, { payload, form, env });
		} catch (error) {
			return {
				ok: false,
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}
	return { ok: true };
}

type MailtoAction = Extract<Action, { type: "mailto" }>;

export function buildMailtoUrl(
	action: MailtoAction,
	form: Form,
	answers: SubmitAnswers,
): string {
	const subject = action.subject ?? form.title;
	const body = buildMailtoBody(form, answers);
	return `mailto:${action.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Table/rubric cells show the choice title with the machine value appended
// when they differ, e.g. "Competent (2)".
function choiceLabel(value: string, choices: readonly Choice[]): string {
	const choice = choices.find((c) => c.value === value);
	return choice && choice.title !== choice.value
		? `${choice.title} (${value})`
		: value;
}

function renderCell(cell: AnswerCell, choices: readonly Choice[]): string {
	if (Array.isArray(cell)) {
		return cell.map((v) => choiceLabel(v, choices)).join(", ");
	}
	if (typeof cell === "object") {
		const label =
			cell.value === undefined ? "" : choiceLabel(cell.value, choices);
		if (cell.comment)
			return label ? `${label} — ${cell.comment}` : cell.comment;
		return label;
	}
	return choiceLabel(cell, choices);
}

function isAnsweredCell(cell: AnswerCell | undefined): cell is AnswerCell {
	if (cell === undefined || cell === "") return false;
	if (Array.isArray(cell)) return cell.length > 0;
	return true;
}

// Human-readable plain-text body using item titles; the documented format in
// docs/reference.md.
export function buildMailtoBody(form: Form, answers: SubmitAnswers): string {
	const lines = [form.title, "=".repeat(form.title.length)];
	for (const item of form.items) {
		const answer = answers[item.id];
		if (answer === undefined) continue;
		if (item.type === "choice_table" || item.type === "rubric") {
			if (typeof answer !== "object" || Array.isArray(answer)) continue;
			const rowLines = item.items
				.map((row) => ({ row, cell: answer[row.key] }))
				.filter(
					(
						entry,
					): entry is { row: (typeof item.items)[number]; cell: AnswerCell } =>
						isAnsweredCell(entry.cell),
				)
				.map(
					({ row, cell }) =>
						`  ${row.title}: ${renderCell(cell, item.choices)}`,
				);
			if (rowLines.length === 0) continue;
			lines.push(`${item.title}:`, ...rowLines);
		} else {
			if (typeof answer === "string") {
				if (answer === "") continue;
				lines.push(`${item.title}: ${answer}`);
			} else if (Array.isArray(answer)) {
				if (answer.length === 0) continue;
				lines.push(`${item.title}: ${answer.join(", ")}`);
			}
		}
	}
	return lines.join("\n");
}
