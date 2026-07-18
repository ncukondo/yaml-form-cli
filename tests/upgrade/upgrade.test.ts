import { describe, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";
import {
	assetNameFor,
	compareVersions,
	isRuntimeInstall,
	runUpgrade,
	type UpgradeEnv,
} from "../../src/upgrade.ts";

function sha256(data: Uint8Array): string {
	return createHash("sha256").update(data).digest("hex");
}

const binaryData = new TextEncoder().encode("new-binary-bytes");

function makeEnv(overrides: Partial<UpgradeEnv> = {}) {
	const logs: string[] = [];
	const errors: string[] = [];
	const release = {
		tag_name: "v1.2.0",
		assets: [
			{
				name: "yaml-form-linux-x64",
				browser_download_url: "https://example.com/yaml-form-linux-x64",
			},
			{
				name: "SHA256SUMS",
				browser_download_url: "https://example.com/SHA256SUMS",
			},
		],
	};
	const sums = `${sha256(binaryData)}  yaml-form-linux-x64\n`;
	const env = {
		currentVersion: "1.0.0",
		execPath: "/usr/local/bin/yaml-form",
		platform: "linux",
		arch: "x64",
		fetchJson: mock(async (_url: string) => release),
		download: mock(async (url: string) =>
			url.endsWith("SHA256SUMS") ? new TextEncoder().encode(sums) : binaryData,
		),
		replaceSelf: mock(async (_path: string, _data: Uint8Array) => {}),
		log: (m: string) => {
			logs.push(m);
		},
		error: (m: string) => {
			errors.push(m);
		},
	};
	Object.assign(env, overrides);
	return Object.assign(env, { logs, errors });
}

describe("compareVersions", () => {
	test("orders semantic versions numerically", () => {
		expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
		expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
		expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
		expect(compareVersions("0.0.9", "0.1.0")).toBeLessThan(0);
	});
});

describe("assetNameFor", () => {
	test("maps platform/arch to release asset names", () => {
		expect(assetNameFor("linux", "x64")).toBe("yaml-form-linux-x64");
		expect(assetNameFor("linux", "arm64")).toBe("yaml-form-linux-arm64");
		expect(assetNameFor("darwin", "arm64")).toBe("yaml-form-darwin-arm64");
		expect(assetNameFor("win32", "x64")).toBe("yaml-form-windows-x64.exe");
	});

	test("returns undefined for unsupported platforms", () => {
		expect(assetNameFor("freebsd", "x64")).toBeUndefined();
		expect(assetNameFor("linux", "ia32")).toBeUndefined();
	});
});

describe("isRuntimeInstall", () => {
	test("detects bun/node interpreters as non-binary installs", () => {
		expect(isRuntimeInstall("/usr/bin/node")).toBe(true);
		expect(isRuntimeInstall("/home/u/.bun/bin/bun")).toBe(true);
		expect(isRuntimeInstall("C:\\Program Files\\nodejs\\node.exe")).toBe(true);
	});

	test("treats anything else as a compiled binary", () => {
		expect(isRuntimeInstall("/usr/local/bin/yaml-form")).toBe(false);
		expect(isRuntimeInstall("C:\\tools\\yaml-form.exe")).toBe(false);
	});
});

describe("runUpgrade", () => {
	test("npm/dev installs get package-manager guidance, no network", async () => {
		const env = makeEnv({ execPath: "/usr/bin/node" });
		const result = await runUpgrade(env, {});
		expect(result.kind).toBe("not-binary");
		expect(env.fetchJson).not.toHaveBeenCalled();
		expect(env.replaceSelf).not.toHaveBeenCalled();
		expect(env.logs.join("\n")).toContain("@ncukondo/yaml-form");
	});

	test("reports up to date when latest is not newer", async () => {
		const env = makeEnv({ currentVersion: "1.2.0" });
		const result = await runUpgrade(env, {});
		expect(result.kind).toBe("up-to-date");
		expect(env.replaceSelf).not.toHaveBeenCalled();
	});

	test("dry run reports the planned upgrade without downloading", async () => {
		const env = makeEnv();
		const result = await runUpgrade(env, { dryRun: true });
		expect(result).toEqual({
			kind: "dry-run",
			version: "1.2.0",
			asset: "yaml-form-linux-x64",
		});
		expect(env.download).not.toHaveBeenCalled();
		expect(env.replaceSelf).not.toHaveBeenCalled();
	});

	test("upgrades a binary install after checksum verification", async () => {
		const env = makeEnv();
		const result = await runUpgrade(env, {});
		expect(result).toEqual({ kind: "upgraded", version: "1.2.0" });
		expect(env.replaceSelf).toHaveBeenCalledTimes(1);
		const [path, data] = env.replaceSelf.mock.calls[0] as [string, Uint8Array];
		expect(path).toBe("/usr/local/bin/yaml-form");
		expect(sha256(data)).toBe(sha256(binaryData));
	});

	test("aborts on checksum mismatch without replacing", async () => {
		const env = makeEnv({
			download: mock(async (url: string) =>
				url.endsWith("SHA256SUMS")
					? new TextEncoder().encode(`${"0".repeat(64)}  yaml-form-linux-x64\n`)
					: binaryData,
			),
		});
		const result = await runUpgrade(env, {});
		expect(result.kind).toBe("error");
		if (result.kind === "error") expect(result.message).toMatch(/checksum/i);
		expect(env.replaceSelf).not.toHaveBeenCalled();
	});

	test("errors on unsupported platform", async () => {
		const env = makeEnv({ platform: "freebsd" });
		const result = await runUpgrade(env, {});
		expect(result.kind).toBe("error");
		expect(env.replaceSelf).not.toHaveBeenCalled();
	});

	test("errors when the release has no matching asset", async () => {
		const env = makeEnv({
			fetchJson: mock(async () => ({ tag_name: "v1.2.0", assets: [] })),
		});
		const result = await runUpgrade(env, {});
		expect(result.kind).toBe("error");
		expect(env.replaceSelf).not.toHaveBeenCalled();
	});
});
