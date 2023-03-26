import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

import { type PackwatchArguments, type Report } from './types'

const PACKAGE_SIZE_PATT = /package size:\s*([0-9]+\.?[0-9]*\s+[A-Za-z]{1,2})/
const UNPACKED_SIZE_PATT = /unpacked size:\s*([0-9]+\.?[0-9]*\s+[A-Za-z]{1,2})/
const SIZE_SUFFIX_PATT = /([A-Za-z]+)/
const SIZE_MAGNITUDE_PATT = /([0-9]+\.?[0-9]*)/

const MANIFEST_FILENAME = '.packwatch.json'

export function mergeDefaultArguments(args: Partial<PackwatchArguments>): PackwatchArguments {
	return {
		cwd: args.cwd ?? '.',
		isUpdatingManifest: args.isUpdatingManifest ?? false,
	}
}

export function convertSizeToBytes(sizeString: string): number {
	const sizeSuffix = SIZE_SUFFIX_PATT.exec(sizeString)?.[1] ?? ''
	const sizeMagnitude = SIZE_MAGNITUDE_PATT.exec(sizeString)?.[1] ?? '0.0'

	let multiplier = 1

	if (sizeSuffix === 'kB') multiplier = 1000
	else if (sizeSuffix === 'mB') {
		multiplier = 1000000
	}

	return multiplier * parseFloat(sizeMagnitude)
}

export function getCurrentPackageStats(cwd: string): Report {
	const { stderr } = spawnSync('npm', ['pack', '--dry-run'], {
		encoding: 'utf-8',
		cwd,
	})
	const stderrString = String(stderr)
	const packageSize = PACKAGE_SIZE_PATT.exec(stderrString)?.[1] ?? '0'
	const unpackedSize = UNPACKED_SIZE_PATT.exec(stderrString)?.[1] ?? '0'

	return {
		packageSize,
		unpackedSize,
		packageSizeBytes: convertSizeToBytes(packageSize),
		unpackedSizeBytes: convertSizeToBytes(unpackedSize),
	}
}

export function getPreviousPackageStats(cwd: string): Report {
	const manifestPath = resolve(join(cwd, MANIFEST_FILENAME))
	try {
		const currentManifest = readFileSync(manifestPath, {
			encoding: 'utf-8',
		})
		const parsedManifest = JSON.parse(currentManifest)
		return {
			...parsedManifest,
			packageSizeBytes: convertSizeToBytes(parsedManifest.packageSize),
			unpackedSizeBytes: convertSizeToBytes(parsedManifest.unpackedSize),
			limitBytes: convertSizeToBytes(parsedManifest.limit),
		}
	} catch {
		/* No manifest */
		return {
			packageSize: '0',
			packageSizeBytes: 0,
			unpackedSizeBytes: 0,
			unpackedSize: '0',
			limitBytes: 0,
		}
	}
}

export function createOrUpdateManifest({
	previous,
	current,
	manifestPath,
	updateLimit = false,
}: {
	previous?: Report
	current: Report
	manifestPath: string
	updateLimit?: boolean
}): void {
	const { limit } = previous || {}
	const { packageSize, unpackedSize } = current

	const newManifest = {
		limit: updateLimit ? packageSize : limit || packageSize,
		packageSize: packageSize,
		unpackedSize: unpackedSize,
	}

	writeFileSync(manifestPath, JSON.stringify(newManifest))
}
