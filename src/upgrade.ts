// `yaml-form upgrade`: replace a compiled-binary install with the latest
// GitHub release. Network and file operations live behind UpgradeEnv so the
// logic is testable, and the module stays Node-compatible (no Bun APIs).
import { createHash } from "node:crypto";

export const REPO = "ncukondo/yaml-form-cli";
export const PACKAGE_NAME = "@ncukondo/yaml-form";

export interface ReleaseAsset {
	name: string;
	browser_download_url: string;
}

export interface ReleaseInfo {
	tag_name: string;
	assets: ReleaseAsset[];
}

export interface UpgradeEnv {
	currentVersion: string;
	execPath: string;
	platform: string;
	arch: string;
	fetchJson(url: string): Promise<unknown>;
	download(url: string): Promise<Uint8Array>;
	replaceSelf(execPath: string, data: Uint8Array): Promise<void>;
	log(message: string): void;
	error(message: string): void;
}

export type UpgradeResult =
	| { kind: "not-binary" }
	| { kind: "up-to-date"; version: string }
	| { kind: "dry-run"; version: string; asset: string }
	| { kind: "upgraded"; version: string }
	| { kind: "error"; message: string };

/** Numeric semver comparison; non-numeric parts compare as 0. */
export function compareVersions(a: string, b: string): number {
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split(".")
			.map((part) => Number.parseInt(part, 10) || 0);
	const [pa, pb] = [parse(a), parse(b)];
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

const PLATFORM_NAMES: Record<string, string> = {
	linux: "linux",
	darwin: "darwin",
	win32: "windows",
};
const SUPPORTED_ARCHS = new Set(["x64", "arm64"]);

export function assetNameFor(
	platform: string,
	arch: string,
): string | undefined {
	const platformName = PLATFORM_NAMES[platform];
	if (platformName === undefined || !SUPPORTED_ARCHS.has(arch))
		return undefined;
	const ext = platform === "win32" ? ".exe" : "";
	return `yaml-form-${platformName}-${arch}${ext}`;
}

/** True when running under an interpreter (npm/bunx/dev), not a compiled binary. */
export function isRuntimeInstall(execPath: string): boolean {
	const base = execPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
	return ["bun", "bun.exe", "node", "node.exe"].includes(base);
}

function parseSha256Sums(text: string): Map<string, string> {
	const sums = new Map<string, string>();
	for (const line of text.split("\n")) {
		const match = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/);
		if (match?.[1] && match[2]) sums.set(match[2], match[1]);
	}
	return sums;
}

export async function runUpgrade(
	env: UpgradeEnv,
	options: { dryRun?: boolean },
): Promise<UpgradeResult> {
	if (isRuntimeInstall(env.execPath)) {
		env.log(
			`This install runs via a JS runtime, so upgrade it with your package manager:\n` +
				`  npm install -g ${PACKAGE_NAME}@latest\n` +
				`  bun add -g ${PACKAGE_NAME}@latest`,
		);
		return { kind: "not-binary" };
	}

	let release: ReleaseInfo;
	try {
		release = (await env.fetchJson(
			`https://api.github.com/repos/${REPO}/releases/latest`,
		)) as ReleaseInfo;
		if (typeof release?.tag_name !== "string")
			throw new Error("malformed release response");
	} catch (error) {
		const message = `could not fetch the latest release: ${
			error instanceof Error ? error.message : String(error)
		}`;
		env.error(message);
		return { kind: "error", message };
	}

	const latest = release.tag_name.replace(/^v/, "");
	if (compareVersions(latest, env.currentVersion) <= 0) {
		env.log(`Already up to date (v${env.currentVersion}).`);
		return { kind: "up-to-date", version: env.currentVersion };
	}

	const assetName = assetNameFor(env.platform, env.arch);
	if (assetName === undefined) {
		const message = `no prebuilt binary for ${env.platform}/${env.arch}`;
		env.error(message);
		return { kind: "error", message };
	}
	const asset = release.assets.find((a) => a.name === assetName);
	const sumsAsset = release.assets.find((a) => a.name === "SHA256SUMS");
	if (!asset || !sumsAsset) {
		const message = `release ${release.tag_name} is missing ${
			asset ? "SHA256SUMS" : assetName
		}`;
		env.error(message);
		return { kind: "error", message };
	}

	if (options.dryRun) {
		env.log(
			`Would upgrade v${env.currentVersion} -> v${latest} using ${assetName}.`,
		);
		return { kind: "dry-run", version: latest, asset: assetName };
	}

	env.log(`Upgrading v${env.currentVersion} -> v${latest}...`);
	const [sumsData, binary] = [
		await env.download(sumsAsset.browser_download_url),
		await env.download(asset.browser_download_url),
	];
	const expected = parseSha256Sums(new TextDecoder().decode(sumsData)).get(
		assetName,
	);
	const actual = createHash("sha256").update(binary).digest("hex");
	if (expected === undefined || expected !== actual) {
		const message =
			expected === undefined
				? `SHA256SUMS has no entry for ${assetName}; aborting`
				: `checksum mismatch for ${assetName}; aborting (expected ${expected}, got ${actual})`;
		env.error(message);
		return { kind: "error", message };
	}

	try {
		await env.replaceSelf(env.execPath, binary);
	} catch (error) {
		const message = `failed to replace ${env.execPath}: ${
			error instanceof Error ? error.message : String(error)
		}`;
		env.error(message);
		return { kind: "error", message };
	}
	env.log(`Upgraded to v${latest}.`);
	return { kind: "upgraded", version: latest };
}
