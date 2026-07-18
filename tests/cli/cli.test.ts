import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../../package.json";

const projectRoot = new URL("../..", import.meta.url).pathname;
const cliPath = join(projectRoot, "src/cli.ts");
const sampleYaml = join(projectRoot, "examples/sample.yaml");

const tempDir = mkdtempSync(join(tmpdir(), "yaml-form-cli-test-"));
afterAll(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

const invalidYaml = [
	"title: Bad form",
	"items:",
	"  - title: A",
	"    id: dup",
	"  - title: B",
	"    id: dup",
	"    type: bogus",
	"",
].join("\n");

async function runCli(args: string[]) {
	const proc = Bun.spawn(["bun", cliPath, ...args], {
		cwd: projectRoot,
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

describe("valid input", () => {
	test("writes HTML to stdout by default", async () => {
		const { stdout, stderr, exitCode } = await runCli([sampleYaml]);
		expect(exitCode).toBe(0);
		expect(stderr).toBe("");
		expect(stdout.trimStart().toLowerCase()).toStartWith("<!doctype html>");
		expect(stdout).toContain("Test Form");
	});

	test("writes HTML to the file given via -o", async () => {
		const outPath = join(tempDir, "out.html");
		const { stdout, exitCode } = await runCli([sampleYaml, "-o", outPath]);
		expect(exitCode).toBe(0);
		expect(stdout).toBe("");
		const html = await Bun.file(outPath).text();
		expect(html.trimStart().toLowerCase()).toStartWith("<!doctype html>");
	});

	test("accepts the long form --output", async () => {
		const outPath = join(tempDir, "out-long.html");
		const { exitCode } = await runCli([sampleYaml, "--output", outPath]);
		expect(exitCode).toBe(0);
		expect(existsSync(outPath)).toBe(true);
	});
});

describe("invalid input", () => {
	test("exits non-zero with all validation errors (with paths) on stderr", async () => {
		const inputPath = join(tempDir, "invalid.yaml");
		await Bun.write(inputPath, invalidYaml);
		const { stdout, stderr, exitCode } = await runCli([inputPath]);
		expect(exitCode).not.toBe(0);
		expect(stdout).toBe("");
		expect(stderr).toContain("items[1].id");
		expect(stderr).toContain('Duplicate item id "dup"');
		expect(stderr).toContain("items[1].type");
		expect(stderr).toContain('Unknown item type "bogus"');
	});

	test("does not create the -o output file", async () => {
		const inputPath = join(tempDir, "invalid2.yaml");
		const outPath = join(tempDir, "should-not-exist.html");
		await Bun.write(inputPath, invalidYaml);
		const { exitCode } = await runCli([inputPath, "-o", outPath]);
		expect(exitCode).not.toBe(0);
		expect(existsSync(outPath)).toBe(false);
	});

	test("reports YAML syntax errors", async () => {
		const inputPath = join(tempDir, "syntax.yaml");
		await Bun.write(inputPath, "title: [unclosed\n");
		const { stderr, exitCode } = await runCli([inputPath]);
		expect(exitCode).not.toBe(0);
		expect(stderr).not.toBe("");
	});

	test("reports a missing input file", async () => {
		const missing = join(tempDir, "nope.yaml");
		const { stderr, exitCode } = await runCli([missing]);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain(missing);
	});
});

describe("usage, help, and version", () => {
	test("no arguments prints usage on stderr and exits non-zero", async () => {
		const { stderr, exitCode } = await runCli([]);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("yaml-form <input.yaml>");
	});

	test("--help prints usage on stdout and exits 0", async () => {
		const { stdout, exitCode } = await runCli(["--help"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("yaml-form <input.yaml>");
		expect(stdout).toContain("-o, --output");
	});

	test("-h behaves like --help", async () => {
		const { stdout, exitCode } = await runCli(["-h"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("yaml-form <input.yaml>");
	});

	test("--version prints the package.json version", async () => {
		const { stdout, exitCode } = await runCli(["--version"]);
		expect(exitCode).toBe(0);
		expect(stdout.trim()).toBe(pkg.version);
	});
});

describe("upgrade subcommand", () => {
	test("is a placeholder for now", async () => {
		const { stderr, exitCode } = await runCli(["upgrade"]);
		expect(exitCode).not.toBe(0);
		expect(stderr).toContain("not yet available");
	});
});

describe("packaging", () => {
	test("package.json registers the CLI bin entry", () => {
		expect((pkg as { bin?: Record<string, string> }).bin).toEqual({
			"yaml-form": "./src/cli.ts",
		});
	});
});
