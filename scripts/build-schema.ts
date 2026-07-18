import { renderJsonSchema } from "../src/schema/json-schema.ts";

const target = new URL("../schema/yaml-form.schema.json", import.meta.url)
	.pathname;
await Bun.write(target, renderJsonSchema());
console.log(`wrote ${target}`);
