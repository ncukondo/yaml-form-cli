import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseForm } from "../../src/schema/index.ts";

const projectRoot = new URL("../..", import.meta.url).pathname;
const cliPath = join(projectRoot, "src/cli.ts");

async function runCli(args: string[], stdin?: string) {
	const proc = Bun.spawn(["bun", cliPath, ...args], {
		cwd: projectRoot,
		stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout, stderr, exitCode };
}

describe("schema", () => {
	test("prints JSON that parses and matches the built schema file", async () => {
		const { stdout, exitCode } = await runCli(["schema"]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed.$schema).toBeDefined();
		const onDisk = await Bun.file(
			join(projectRoot, "schema/yaml-form.schema.json"),
		).text();
		expect(stdout).toBe(onDisk);
	});

	test("rejects extra arguments as a usage error", async () => {
		const { exitCode } = await runCli(["schema", "extra"]);
		expect(exitCode).toBe(2);
	});
});

describe("docs", () => {
	test("with no topic lists the available topics", async () => {
		const { stdout, exitCode } = await runCli(["docs"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("items");
		expect(stdout).toContain("rules");
	});

	test("a known topic prints that section", async () => {
		const { stdout, exitCode } = await runCli(["docs", "rules"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("visible_when");
		expect(stdout).toContain("yaml-form eval");
	});

	test("an unknown topic exits 2 listing valid topics", async () => {
		const { stderr, exitCode } = await runCli(["docs", "nope"]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("rules");
	});
});

describe("example", () => {
	test("default output parses as a valid form", async () => {
		const { stdout, exitCode } = await runCli(["example"]);
		expect(exitCode).toBe(0);
		expect(parseForm(stdout).ok).toBe(true);
	});

	test("output can be piped straight into validate", async () => {
		const { stdout } = await runCli(["example"]);
		const { exitCode } = await runCli(["validate", "-", "--json"], stdout);
		expect(exitCode).toBe(0);
	});

	test("a named example is served", async () => {
		const { stdout, exitCode } = await runCli(["example", "sample"]);
		expect(exitCode).toBe(0);
		expect(parseForm(stdout).ok).toBe(true);
	});

	test("an unknown example exits 2 listing valid names", async () => {
		const { stderr, exitCode } = await runCli(["example", "nope"]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("sample");
	});
});

describe("help pointers", () => {
	test("--help points at docs, schema, and example", async () => {
		const { stdout } = await runCli(["--help"]);
		expect(stdout).toContain("yaml-form docs");
		expect(stdout).toContain("yaml-form schema");
		expect(stdout).toContain("yaml-form example");
	});
});
