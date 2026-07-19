// Builds the npm-distributable CLI: prebuilds the browser runtime, then
// bundles src/cli.ts (dependencies included) for plain Node into dist/cli.js.
import { rm } from "node:fs/promises";
import { $ } from "bun";

await $`bun scripts/build-runtime.ts`;
await $`bun scripts/build-embedded.ts`;
await rm(new URL("../dist", import.meta.url).pathname, {
	recursive: true,
	force: true,
});

const entry = new URL("../src/cli.ts", import.meta.url).pathname;
const outdir = new URL("../dist", import.meta.url).pathname;
const result = await Bun.build({
	entrypoints: [entry],
	outdir,
	naming: "cli.js",
	target: "node",
	format: "esm",
	minify: false,
	banner: "#!/usr/bin/env node",
});
if (!result.success) {
	console.error(result.logs.join("\n"));
	process.exit(1);
}
const outfile = `${outdir}/cli.js`;
const built = await Bun.file(outfile).text();
if (!built.startsWith("#!/usr/bin/env node\n")) {
	console.error("expected node shebang banner at the top of dist/cli.js");
	process.exit(1);
}
if (built.indexOf("#!/usr/bin/env") !== built.lastIndexOf("#!/usr/bin/env")) {
	console.error("duplicate shebang in dist/cli.js");
	process.exit(1);
}
const { chmod } = await import("node:fs/promises");
await chmod(outfile, 0o755);
console.log(`wrote ${outfile} (${built.length} bytes)`);
