#!/usr/bin/env bun
import pkg from "../package.json";
import { generateHtml } from "./generate/index.ts";
import { parseForm } from "./schema/index.ts";

const USAGE = `Usage: yaml-form <input.yaml> [-o <output.html>]

Options:
  -o, --output <file>   Write HTML to file (default: stdout)
  -h, --help            Show help
  --version             Show version

Subcommands:
  yaml-form upgrade     Self-upgrade to the latest released version
`;

interface CliOptions {
	input: string;
	output?: string;
}

function parseArgs(argv: string[]): CliOptions {
	let input: string | undefined;
	let output: string | undefined;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === undefined) break;
		if (arg === "-o" || arg === "--output") {
			output = argv[++i];
			if (output === undefined) fail(`${arg} requires a file argument`);
		} else if (arg.startsWith("-")) {
			fail(`Unknown option "${arg}"`);
		} else if (input === undefined) {
			input = arg;
		} else {
			fail(`Unexpected argument "${arg}"`);
		}
	}
	if (input === undefined) fail("Missing input file");
	return { input, output };
}

function fail(message: string): never {
	console.error(`yaml-form: ${message}\n\n${USAGE}`);
	process.exit(1);
}

async function main(argv: string[]): Promise<void> {
	if (argv.length === 0) {
		console.error(USAGE);
		process.exit(1);
	}
	if (argv.includes("-h") || argv.includes("--help")) {
		console.log(USAGE);
		return;
	}
	if (argv.includes("--version")) {
		console.log(pkg.version);
		return;
	}
	if (argv[0] === "upgrade") {
		console.error("yaml-form upgrade is not yet available");
		process.exit(1);
	}

	const options = parseArgs(argv);

	const file = Bun.file(options.input);
	if (!(await file.exists())) {
		console.error(`yaml-form: cannot read ${options.input}: no such file`);
		process.exit(1);
	}
	const source = await file.text();

	const result = parseForm(source);
	if (!result.ok) {
		for (const error of result.errors) {
			const location = error.path === "" ? options.input : error.path;
			console.error(`error[${error.code}] ${location}: ${error.message}`);
		}
		process.exit(1);
	}

	const html = await generateHtml(result.form);
	if (options.output === undefined) {
		process.stdout.write(html);
	} else {
		await Bun.write(options.output, html);
	}
}

await main(process.argv.slice(2));
