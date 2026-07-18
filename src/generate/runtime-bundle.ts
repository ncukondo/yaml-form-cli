import { runtimeBundle } from "./runtime.generated.ts";

/**
 * The browser runtime as an inline script, prebuilt by
 * `bun run build:runtime` into runtime.generated.ts so generation works
 * without a bundler (Node, compiled binaries).
 */
export async function getRuntimeBundle(): Promise<string> {
	return runtimeBundle;
}
