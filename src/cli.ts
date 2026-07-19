// Must stay runnable under plain Node (npx) as well as Bun: no Bun.* APIs.
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import pkg from "../package.json";
import { generateHtml } from "./generate/index.ts";
import type { FormError } from "./schema/errors.ts";
import { type Form, parseForm } from "./schema/index.ts";
import { runUpgrade, type UpgradeEnv } from "./upgrade.ts";

function makeUpgradeEnv(): UpgradeEnv {
	const headers = {
		"User-Agent": `yaml-form/${pkg.version}`,
		Accept: "application/vnd.github+json",
	};
	return {
		currentVersion: pkg.version,
		execPath: process.execPath,
		platform: process.platform,
		arch: process.arch,
		async fetchJson(url) {
			const res = await fetch(url, { headers });
			if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
			return res.json();
		},
		async download(url) {
			const res = await fetch(url, {
				headers: { "User-Agent": headers["User-Agent"] },
			});
			if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
			return new Uint8Array(await res.arrayBuffer());
		},
		async replaceSelf(execPath, data) {
			const next = `${execPath}.new`;
			await writeFile(next, data);
			await chmod(next, 0o755);
			if (process.platform === "win32") {
				// a running .exe cannot be overwritten, but it can be renamed away
				await rename(execPath, `${execPath}.old`);
			}
			await rename(next, execPath);
			await rm(`${execPath}.old`, { force: true }).catch(() => {});
		},
		log: (message) => console.log(message),
		error: (message) => console.error(`yaml-form: ${message}`),
	};
}

const USAGE = `yaml-form — generate a self-contained HTML form from YAML

Usage:
  yaml-form generate <input.yaml|-> [-o <out.html>] [--json]
  yaml-form validate <input.yaml|-> [--json]
  yaml-form upgrade [--dry-run]

Commands:
  generate   Render the form to HTML (default: stdout; -o writes a file).
  validate   Parse and cross-check only; report every problem found.
  upgrade    Self-upgrade a binary install (npm installs: use your
             package manager).

Conventions:
  <input> of "-" reads YAML from stdin.
  --json     Emit a single JSON object instead of human text:
             {"ok":true,...} or {"ok":false,"errors":[{code,path,message}]}.

Options:
  -o, --output <file>   Write generated HTML to a file (default: stdout).
  -h, --help            Show this help.
  --version             Show version.

Exit codes:
  0  success
  1  operation failed (validation / generation / upgrade error)
  2  usage error (unknown command or option, missing argument)

Format reference: see docs/reference.md and examples/sample.yaml.
`;

/** 0 success, 1 operation failed, 2 usage error. */
type ExitCode = 0 | 1 | 2;

function usage(message: string): never {
	console.error(`yaml-form: ${message}\n\n${USAGE}`);
	process.exit(2);
}

/** Read a source file, or stdin when the path is "-". */
async function readInput(path: string): Promise<string> {
	if (path === "-") return readStdin();
	try {
		return await readFile(path, "utf8");
	} catch {
		throw new OperationError(`cannot read ${path}: no such file`);
	}
}

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}

/** An expected, reportable failure (exit 1) — distinct from a usage error. */
class OperationError extends Error {
	constructor(
		message: string,
		readonly errors?: FormError[],
	) {
		super(message);
	}
}

function reportErrors(
	errors: FormError[],
	json: boolean,
	inputLabel: string,
): void {
	if (json) {
		process.stdout.write(`${JSON.stringify({ ok: false, errors })}\n`);
		return;
	}
	for (const error of errors) {
		const location = error.path === "" ? inputLabel : error.path;
		console.error(`error[${error.code}] ${location}: ${error.message}`);
	}
}

/** Parse an input into a Form, throwing OperationError with all form errors. */
async function loadForm(path: string): Promise<Form> {
	const source = await readInput(path);
	const result = parseForm(source);
	if (!result.ok) throw new OperationError("validation failed", result.errors);
	return result.form;
}

interface GenerateOptions {
	input: string;
	output?: string;
	json: boolean;
}

function parseGenerateArgs(argv: string[]): GenerateOptions {
	let input: string | undefined;
	let output: string | undefined;
	let json = false;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === undefined) break;
		if (arg === "-o" || arg === "--output") {
			output = argv[++i];
			if (output === undefined) usage(`${arg} requires a file argument`);
		} else if (arg === "--json") {
			json = true;
		} else if (arg.startsWith("-") && arg !== "-") {
			usage(`Unknown option "${arg}"`);
		} else if (input === undefined) {
			input = arg;
		} else {
			usage(`Unexpected argument "${arg}"`);
		}
	}
	if (input === undefined) usage("generate: missing input (file or '-')");
	return { input, output, json };
}

async function cmdGenerate(argv: string[]): Promise<ExitCode> {
	const opts = parseGenerateArgs(argv);
	if (opts.json && opts.output === undefined) {
		usage("generate --json requires -o <file> (HTML cannot share stdout)");
	}
	let form: Form;
	try {
		form = await loadForm(opts.input);
	} catch (err) {
		if (err instanceof OperationError) {
			if (err.errors) reportErrors(err.errors, opts.json, opts.input);
			else reportFailure(err.message, opts.json);
			return 1;
		}
		throw err;
	}
	const html = await generateHtml(form);
	if (opts.output === undefined) {
		process.stdout.write(html);
	} else {
		await writeFile(opts.output, html);
	}
	if (opts.json) {
		const payload = {
			ok: true as const,
			output: opts.output ?? null,
			bytes: Buffer.byteLength(html),
		};
		process.stdout.write(`${JSON.stringify(payload)}\n`);
	}
	return 0;
}

interface ValidateOptions {
	input: string;
	json: boolean;
}

function parseValidateArgs(argv: string[]): ValidateOptions {
	let input: string | undefined;
	let json = false;
	for (const arg of argv) {
		if (arg === "--json") json = true;
		else if (arg.startsWith("-") && arg !== "-")
			usage(`Unknown option "${arg}"`);
		else if (input === undefined) input = arg;
		else usage(`Unexpected argument "${arg}"`);
	}
	if (input === undefined) usage("validate: missing input (file or '-')");
	return { input, json };
}

async function cmdValidate(argv: string[]): Promise<ExitCode> {
	const opts = parseValidateArgs(argv);
	let source: string;
	try {
		source = await readInput(opts.input);
	} catch (err) {
		if (err instanceof OperationError) {
			reportFailure(err.message, opts.json);
			return 1;
		}
		throw err;
	}
	const result = parseForm(source);
	if (!result.ok) {
		reportErrors(result.errors, opts.json, opts.input);
		return 1;
	}
	if (opts.json) process.stdout.write(`${JSON.stringify({ ok: true })}\n`);
	return 0;
}

function reportFailure(message: string, json: boolean): void {
	if (json) {
		const errors: FormError[] = [{ code: "yaml_syntax", path: "", message }];
		process.stdout.write(`${JSON.stringify({ ok: false, errors })}\n`);
	} else {
		console.error(`yaml-form: ${message}`);
	}
}

async function cmdUpgrade(argv: string[]): Promise<ExitCode> {
	const result = await runUpgrade(makeUpgradeEnv(), {
		dryRun: argv.includes("--dry-run"),
	});
	return result.kind === "error" ? 1 : 0;
}

const COMMANDS: Record<string, (argv: string[]) => Promise<ExitCode>> = {
	generate: cmdGenerate,
	validate: cmdValidate,
	upgrade: cmdUpgrade,
};

async function main(argv: string[]): Promise<ExitCode> {
	if (argv.includes("-h") || argv.includes("--help")) {
		console.log(USAGE);
		return 0;
	}
	if (argv.includes("--version")) {
		console.log(pkg.version);
		return 0;
	}
	const [command, ...rest] = argv;
	if (command === undefined) {
		usage("no command given");
	}
	const handler = COMMANDS[command];
	if (handler === undefined) {
		if (!command.startsWith("-") && /\.(ya?ml)$/i.test(command)) {
			usage(`did you mean "generate ${command}"? (the bare form was removed)`);
		}
		usage(
			`Unknown command "${command}". Known: ${Object.keys(COMMANDS).join(", ")}`,
		);
	}
	return handler(rest);
}

process.exit(await main(process.argv.slice(2)));
