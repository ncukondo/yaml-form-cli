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

describe("generate", () => {
	test("writes HTML to stdout by default", async () => {
		const { stdout, stderr, exitCode } = await runCli(["generate", sampleYaml]);
		expect(exitCode).toBe(0);
		expect(stderr).toBe("");
		expect(stdout.trimStart().toLowerCase()).toStartWith("<!doctype html>");
		expect(stdout).toContain("Test Form");
	});

	test("writes HTML to the file given via -o", async () => {
		const outPath = join(tempDir, "out.html");
		const { stdout, exitCode } = await runCli([
			"generate",
			sampleYaml,
			"-o",
			outPath,
		]);
		expect(exitCode).toBe(0);
		expect(stdout).toBe("");
		const html = await Bun.file(outPath).text();
		expect(html.trimStart().toLowerCase()).toStartWith("<!doctype html>");
	});

	test("accepts the long form --output", async () => {
		const outPath = join(tempDir, "out-long.html");
		const { exitCode } = await runCli([
			"generate",
			sampleYaml,
			"--output",
			outPath,
		]);
		expect(exitCode).toBe(0);
		expect(existsSync(outPath)).toBe(true);
	});

	test("reads YAML from stdin when input is '-'", async () => {
		const yaml = "title: Piped\nitems:\n  - id: name\n    title: Name\n";
		const { stdout, exitCode } = await runCli(["generate", "-"], yaml);
		expect(exitCode).toBe(0);
		expect(stdout.trimStart().toLowerCase()).toStartWith("<!doctype html>");
	});

	test("--json with -o reports output metadata", async () => {
		const outPath = join(tempDir, "out.json.html");
		const { stdout, exitCode } = await runCli([
			"generate",
			sampleYaml,
			"-o",
			outPath,
			"--json",
		]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed.ok).toBe(true);
		expect(parsed.output).toBe(outPath);
		expect(parsed.bytes).toBeGreaterThan(0);
	});

	test("--json without -o is a usage error", async () => {
		const { exitCode } = await runCli(["generate", sampleYaml, "--json"]);
		expect(exitCode).toBe(2);
	});

	test("--fragment emits a fragment for a form with an id", async () => {
		const yaml =
			"title: T\nid: survey1\nactions:\n  - type: log\nitems:\n  - { id: a, title: A }\n";
		const { stdout, stderr, exitCode } = await runCli(
			["generate", "--fragment", "-"],
			yaml,
		);
		expect(exitCode).toBe(0);
		expect(stderr).toBe("");
		expect(stdout.trimStart()).toStartWith(
			'<div class="yaml-form-root" id="yf-survey1" lang="en">',
		);
		expect(stdout).not.toContain("<!doctype");
	});

	test("--fragment without an id fails with a clear message (exit 1)", async () => {
		const yaml =
			"title: T\nactions:\n  - type: log\nitems:\n  - { id: a, title: A }\n";
		const { stderr, exitCode } = await runCli(
			["generate", "--fragment", "-"],
			yaml,
		);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("--fragment");
		expect(stderr.toLowerCase()).toContain("id");
	});
});

describe("validate", () => {
	test("exits 0 on valid input with no stdout in human mode", async () => {
		const { stdout, stderr, exitCode } = await runCli(["validate", sampleYaml]);
		expect(exitCode).toBe(0);
		expect(stdout).toBe("");
		expect(stderr).toBe("");
	});

	test("exits 1 and reports every error with paths on stderr", async () => {
		const inputPath = join(tempDir, "invalid.yaml");
		await Bun.write(inputPath, invalidYaml);
		const { stdout, stderr, exitCode } = await runCli(["validate", inputPath]);
		expect(exitCode).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain("items[1].id");
		expect(stderr).toContain('Duplicate item id "dup"');
		expect(stderr).toContain("items[1].type");
		expect(stderr).toContain('Unknown item type "bogus"');
	});

	test("--json emits ok:true on success", async () => {
		const { stdout, exitCode } = await runCli([
			"validate",
			sampleYaml,
			"--json",
		]);
		expect(exitCode).toBe(0);
		expect(JSON.parse(stdout)).toEqual({ ok: true });
	});

	test("--json emits ok:false with a structured error list", async () => {
		const inputPath = join(tempDir, "invalid-json.yaml");
		await Bun.write(inputPath, invalidYaml);
		const { stdout, stderr, exitCode } = await runCli([
			"validate",
			inputPath,
			"--json",
		]);
		expect(exitCode).toBe(1);
		expect(stderr).toBe("");
		const parsed = JSON.parse(stdout);
		expect(parsed.ok).toBe(false);
		expect(Array.isArray(parsed.errors)).toBe(true);
		const codes = parsed.errors.map((e: { code: string }) => e.code);
		expect(codes).toContain("duplicate_item_id");
		expect(codes).toContain("unknown_item_type");
		for (const e of parsed.errors) {
			expect(typeof e.code).toBe("string");
			expect(typeof e.path).toBe("string");
			expect(typeof e.message).toBe("string");
		}
	});

	test("validates YAML from stdin", async () => {
		const yaml = "title: T\nitems:\n  - id: a\n    title: A\n";
		const { exitCode } = await runCli(["validate", "-", "--json"], yaml);
		expect(exitCode).toBe(0);
	});

	test("reports YAML syntax errors", async () => {
		const inputPath = join(tempDir, "syntax.yaml");
		await Bun.write(inputPath, "title: [unclosed\n");
		const { stderr, exitCode } = await runCli(["validate", inputPath]);
		expect(exitCode).toBe(1);
		expect(stderr).not.toBe("");
	});

	test("does not create the -o file when generation input is invalid", async () => {
		const inputPath = join(tempDir, "invalid2.yaml");
		const outPath = join(tempDir, "should-not-exist.html");
		await Bun.write(inputPath, invalidYaml);
		const { exitCode } = await runCli(["generate", inputPath, "-o", outPath]);
		expect(exitCode).toBe(1);
		expect(existsSync(outPath)).toBe(false);
	});

	test("reports a missing input file", async () => {
		const missing = join(tempDir, "nope.yaml");
		const { stderr, exitCode } = await runCli(["validate", missing]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain(missing);
	});
});

describe("usage, help, and version", () => {
	test("no arguments prints usage on stderr and exits 2", async () => {
		const { stderr, exitCode } = await runCli([]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("yaml-form generate");
	});

	test("the removed bare form points at generate and exits 2", async () => {
		const { stderr, exitCode } = await runCli([sampleYaml]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("generate");
	});

	test("an unknown command exits 2 listing known commands", async () => {
		const { stderr, exitCode } = await runCli(["frobnicate"]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("generate");
		expect(stderr).toContain("validate");
	});

	test("--help prints usage on stdout and exits 0", async () => {
		const { stdout, exitCode } = await runCli(["--help"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("yaml-form generate");
		expect(stdout).toContain("-o, --output");
		expect(stdout).toContain("Exit codes");
	});

	test("-h behaves like --help", async () => {
		const { stdout, exitCode } = await runCli(["-h"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("yaml-form generate");
	});

	test("--version prints the package.json version", async () => {
		const { stdout, exitCode } = await runCli(["--version"]);
		expect(exitCode).toBe(0);
		expect(stdout.trim()).toBe(pkg.version);
	});
});

describe("upgrade subcommand", () => {
	test("running under a JS runtime prints package-manager guidance", async () => {
		const { stdout, exitCode } = await runCli(["upgrade"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("@ncukondo/yaml-form");
		expect(stdout).toContain("package manager");
	});
});

describe("packaging", () => {
	test("package.json registers the CLI bin entry", () => {
		expect((pkg as { bin?: Record<string, string> }).bin).toEqual({
			"yaml-form": "./dist/cli.js",
		});
	});
});
