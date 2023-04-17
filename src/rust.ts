/* eslint-disable import/no-mutable-exports */

import * as core from '@actions/core';
import * as exec from '@actions/exec';

export let RUST_VERSION = '';
export let RUST_HASH = '';

export async function extractRustVersion(toolchain: string) {
	let out = '';

	await exec.exec('rustc', [`+${toolchain}`, '--version', '--verbose'], {
		listeners: {
			stdout(data: Buffer) {
				out += data.toString();
			},
		},
	});

	out.split('\n').forEach((line) => {
		if (line.startsWith('commit-hash')) {
			const value = line.split(':')[1].trim();

			core.setOutput('rust-hash', value);
			RUST_HASH = value;

			// version
		} else if (line.startsWith('release')) {
			const value = line.split(':')[1].trim();

			core.setOutput('rust-version', value);
			RUST_VERSION = value;
		}
	});
}
