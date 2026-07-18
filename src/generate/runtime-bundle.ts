let cached: string | undefined;

/**
 * Bundle the browser runtime (src/runtime/main.ts) into a single inline
 * script. Uses Bun.build at generation time; distribution builds for Node
 * will prebuild this bundle instead (task 0009).
 */
export async function getRuntimeBundle(): Promise<string> {
	if (cached !== undefined) return cached;
	const entry = new URL("../runtime/main.ts", import.meta.url).pathname;
	const result = await Bun.build({
		entrypoints: [entry],
		target: "browser",
		minify: true,
	});
	const output = result.outputs[0];
	if (!result.success || !output) {
		throw new Error(`failed to bundle form runtime: ${result.logs.join("\n")}`);
	}
	cached = await output.text();
	return cached;
}
