// Must stay runnable under plain Node (npx) as well as Bun: no Bun.* APIs.
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import pkg from "../package.json";
import { generateHtml } from "./generate/index.ts";
import { parseForm } from "./schema/index.ts";
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

const USAGE = `Usage: yaml-form <input.yaml> [-o <output.html>]

Options:
  -o, --output <file>   Write HTML to file (default: stdout)
  -h, --help            Show help
  --version             Show version

Subcommands:
  yaml-form upgrade [--dry-run]
                        Self-upgrade a binary install to the latest release
                        (npm installs: upgrade via your package manager)
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
		const result = await runUpgrade(makeUpgradeEnv(), {
			dryRun: argv.includes("--dry-run"),
		});
		process.exit(result.kind === "error" ? 1 : 0);
	}

	const options = parseArgs(argv);

	let source: string;
	try {
		source = await readFile(options.input, "utf8");
	} catch {
		console.error(`yaml-form: cannot read ${options.input}: no such file`);
		process.exit(1);
	}

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
		await writeFile(options.output, html);
	}
}

await main(process.argv.slice(2));
