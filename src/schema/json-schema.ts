import { z } from "zod";
import { formSchema } from "./form-schema.ts";

export function emitJsonSchema(): Record<string, unknown> {
	const schema = z.toJSONSchema(formSchema, {
		target: "draft-7",
		io: "input",
	}) as Record<string, unknown>;
	return {
		$schema: schema.$schema,
		title: "yaml-form form definition",
		description:
			"YAML form definition accepted by yaml-form. Constraints the schema cannot express (unique ids, descriptor counts, rule keys) are checked at generation time.",
		...schema,
	};
}

export function renderJsonSchema(): string {
	return `${JSON.stringify(emitJsonSchema(), null, "\t")}\n`;
}
