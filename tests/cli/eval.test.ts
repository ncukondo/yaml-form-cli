import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectRoot = new URL("../..", import.meta.url).pathname;
const cliPath = join(projectRoot, "src/cli.ts");
const sampleYaml = join(projectRoot, "examples/sample.yaml");

const tempDir = mkdtempSync(join(tmpdir(), "yaml-form-eval-test-"));
afterAll(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

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

async function evalVisible(answers: string, stdin?: string) {
	const { stdout, exitCode } = await runCli(
		["eval", stdin === undefined ? sampleYaml : "-", "--answers", answers],
		stdin,
	);
	expect(exitCode).toBe(0);
	const parsed = JSON.parse(stdout);
	expect(parsed.ok).toBe(true);
	return parsed.visible as Record<string, boolean>;
}

describe("eval", () => {
	test("a choice condition toggles its dependent item", async () => {
		const yes = await evalVisible('{"has_other":"yes"}');
		expect(yes.other_comments).toBe(true);

		const no = await evalVisible('{"has_other":"no"}');
		expect(no.other_comments).toBe(false);
	});

	test("empty answers hide conditioned items but keep unconditioned ones", async () => {
		const visible = await evalVisible("{}");
		expect(visible.other_comments).toBe(false);
		expect(visible.clarity_feedback).toBe(false);
		// an item with no visible_when is always present
		expect(visible.id_sample).toBe(true);
	});

	test("nested rubric answers flatten to dotted keys", async () => {
		const novice = await evalVisible('{"presentation_rubric":{"clarity":"1"}}');
		expect(novice.clarity_feedback).toBe(true);

		const expert = await evalVisible('{"presentation_rubric":{"clarity":"3"}}');
		expect(expert.clarity_feedback).toBe(false);
	});

	test("every item id appears exactly once in the output", async () => {
		const { stdout } = await runCli(["eval", sampleYaml, "--answers", "{}"]);
		const visible = JSON.parse(stdout).visible as Record<string, boolean>;
		const ids = Object.keys(visible);
		expect(new Set(ids).size).toBe(ids.length);
		// known ids from the sample are all present
		for (const id of ["id_sample", "has_other", "other_comments"]) {
			expect(ids).toContain(id);
		}
	});

	test("malformed --answers JSON is a usage error (exit 2)", async () => {
		const { stderr, exitCode } = await runCli([
			"eval",
			sampleYaml,
			"--answers",
			"{not json",
		]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("--answers");
	});

	test("missing --answers is a usage error", async () => {
		const { exitCode } = await runCli(["eval", sampleYaml]);
		expect(exitCode).toBe(2);
	});

	test("an invalid form exits 1 with validate-shaped errors", async () => {
		const bad = join(tempDir, "bad.yaml");
		await Bun.write(bad, "title: T\nitems:\n  - id: a\n    type: bogus\n");
		const { stdout, exitCode } = await runCli(["eval", bad, "--answers", "{}"]);
		expect(exitCode).toBe(1);
		const parsed = JSON.parse(stdout);
		expect(parsed.ok).toBe(false);
		expect(Array.isArray(parsed.errors)).toBe(true);
	});

	test("reads answers from @file", async () => {
		const answersFile = join(tempDir, "answers.json");
		await Bun.write(answersFile, '{"has_other":"yes"}');
		const { stdout, exitCode } = await runCli([
			"eval",
			sampleYaml,
			"--answers",
			`@${answersFile}`,
		]);
		expect(exitCode).toBe(0);
		expect(JSON.parse(stdout).visible.other_comments).toBe(true);
	});

	test("reads answers from stdin with --answers -", async () => {
		const { stdout, exitCode } = await runCli(
			["eval", sampleYaml, "--answers", "-"],
			'{"has_other":"yes"}',
		);
		expect(exitCode).toBe(0);
		expect(JSON.parse(stdout).visible.other_comments).toBe(true);
	});

	test("reads the form from stdin while answers are inline", async () => {
		const visible = await evalVisible(
			'{"has_other":"yes"}',
			[
				"title: T",
				"items:",
				"  - type: choice",
				"    id: has_other",
				"    title: Other?",
				'    choices: ["yes", "no"]',
				"  - type: long_text",
				"    id: other_comments",
				"    title: Comments",
				`    visible_when: 'has_other = "yes"'`,
				"",
			].join("\n"),
		);
		expect(visible.other_comments).toBe(true);
	});
});
