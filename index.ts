import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import { CARGO_HOME } from './src/cache';
import { installBins, restoreCache } from './src/cargo';
import { installToolchain } from './src/rust';

export async function installRustup() {
	try {
		await io.which('rustup', true);
		return;
	} catch {
		// Doesn't exist
	}

	core.info('rustup does not exist, attempting to install');

	const script = await tc.downloadTool(
		process.platform === 'win32' ? 'https://win.rustup.rs' : 'https://sh.rustup.rs',
		path.join(os.tmpdir(), 'rustup-init'),
	);

	core.info(`Downloaded installation script to ${script}`);

	// eslint-disable-next-line no-magic-numbers
	await fs.promises.chmod(script, 0o755);

	await exec.exec(script, ['--default-toolchain', 'none', '-y']);

	core.info('Installed rustup');
}

export async function createDenyToml() {
	try {
		const denyTomlPath = path.join(process.cwd(), 'deny.toml');
		await fs.promises.mkdir(path.dirname(denyTomlPath), { recursive: true });
		const denyTomlContent = `
[advisories]
ignore = [
    "RUSTSEC-2023-0071", # Marvin RSA attack -- No fix on the horizon
    "RUSTSEC-2024-0436", # paste is unmaintained
]

[licenses]
confidence-threshold = 0.93
allow = [
	"MIT",              # MIT License
	"Apache-2.0",       # Apache License 2.0
  "Unicode-3.0",      # Unicode v3
  "Zlib",
  "BSD-3-Clause",
  "MPL-2.0",
  "ISC",
]
private = { ignore = true, registries = ["ocr-labs"] }
`;
		await fs.promises.writeFile(denyTomlPath, denyTomlContent, 'utf8');

		core.info(`deny.toml file created at ${denyTomlPath}`);
	} catch (error) {
		core.setFailed(`Error creating deny.toml: ${(error as Error).message}`);
	}
}

async function run() {
	core.info('Setting cargo environment variables');

	core.exportVariable('CARGO_INCREMENTAL', '0');
	core.exportVariable('CARGO_TERM_COLOR', 'always');

	core.info('Adding ~/.cargo/bin to PATH');

	core.addPath(path.join(CARGO_HOME, 'bin'));

	try {
		await installRustup();
		await installToolchain();
		await installBins();

		// Restore cache after the toolchain has been installed,
		// as we use the rust version and commit hashes in the cache key!
		await restoreCache();

		await createDenyToml();
	} catch (error: unknown) {
		core.setFailed((error as Error).message);

		throw error;
	}
}

void run();
