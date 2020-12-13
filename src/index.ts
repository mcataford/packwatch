import { spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'

import { Report } from './index.d'

const PACKAGE_SIZE_PATT = /package size:\s*([0-9]+\.?[0-9]*\s+[A-Za-z]{1,2})/
const UNPACKED_SIZE_PATT = /unpacked size:\s*([0-9]+\.?[0-9]*\s+[A-Za-z]{1,2})/
const SIZE_SUFFIX_PATT = /([A-Za-z]+)/
const SIZE_MAGNITUDE_PATT = /([0-9]+\.?[0-9]*)/

const MANIFEST_FILENAME = '.packwatch.json'

function convertSizeToBytes(sizeString: string): number {
    const sizeSuffix = SIZE_SUFFIX_PATT.exec(sizeString)[1]
    const sizeMagnitude = SIZE_MAGNITUDE_PATT.exec(sizeString)[1]

    let multiplier = 1

    if (sizeSuffix === 'kB') multiplier = 1000
    else if (sizeSuffix === 'mB') {
        multiplier = 1000000
    }

    return multiplier * parseFloat(sizeMagnitude)
}

function getCurrentPackageStats(): Report {
    const { stderr } = spawnSync('npm', ['pack', '--dry-run'], {
        encoding: 'utf-8',
    })
    const stderrString = String(stderr)
    const packageSize = PACKAGE_SIZE_PATT.exec(stderrString)[1]
    const unpackedSize = UNPACKED_SIZE_PATT.exec(stderrString)[1]

    return {
        packageSize,
        unpackedSize,
        packageSizeBytes: convertSizeToBytes(packageSize),
        unpackedSizeBytes: convertSizeToBytes(unpackedSize),
    }
}

function getPreviousPackageStats(): Report | null {
    try {
        const currentManifest = readFileSync(MANIFEST_FILENAME, {
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
    }
}

function createOrUpdateManifest({
    previous,
    current,
    updateLimit = false,
}: {
    previous?: Report
    current: Report
    updateLimit?: boolean
}): void {
    const { limit } = previous || {}
    const { packageSize, unpackedSize } = current

    const newManifest = {
        limit: updateLimit ? packageSize : limit || packageSize,
        packageSize: packageSize,
        unpackedSize: unpackedSize,
    }

    writeFileSync(MANIFEST_FILENAME, JSON.stringify(newManifest))
}
export default function run(
    {
        manifestFn = MANIFEST_FILENAME,
        isUpdatingManifest,
    }: { manifestFn?: string; isUpdatingManifest?: boolean } = {
        manifestFn: MANIFEST_FILENAME,
        isUpdatingManifest: false,
    },
): number {
    if (!existsSync('package.json')) {
        console.log(
            '🤔 There is no package.json file here. Are you in the root directory of your project?',
        )
        return 1
    }

    const currentStats = getCurrentPackageStats()

    /*
     * If there is no manifest file yet, we can use the current package stats as
     * a base to build one. The current package size becomes the limit.
     */

    if (!existsSync(manifestFn)) {
        createOrUpdateManifest({ current: currentStats })
        console.log(
            `📝 No Manifest to compare against! Current package stats written to ${MANIFEST_FILENAME}!\nPackage size (${currentStats.packageSize}) adopted as new limit.`,
        )

        if (!isUpdatingManifest) {
            console.log(
                '❗ It looks like you ran PackWatch without a manifest. To prevent accidental passes in CI or hooks, packwatch will terminate with an error. If you are running packwatch for the first time in your project, this is expected!',
            )
        }
        // If the update flag wasn't specified, exit with a non-zero code so we
        // don't "accidentally" pass CI builds if the manifest didn't exist
        return isUpdatingManifest ? 0 : 1
    }

    const previousStats = getPreviousPackageStats()
    const { packageSizeBytes, packageSize } = currentStats
    const {
        packageSize: previousSize,
        packageSizeBytes: previousSizeBytes,
        limit,
        limitBytes,
    } = previousStats
    const hasExceededLimit = packageSizeBytes > limitBytes

    /*
     * If we are updating the manifest, we can write right away and terminate.
     */

    if (isUpdatingManifest) {
        createOrUpdateManifest({
            previous: previousStats,
            current: currentStats,
            updateLimit: true,
        })
        console.log(
            `📝 Updated the manifest! Package size: ${packageSize}, Limit: ${packageSize}`,
        )
        return 0
    }

    /*
     * If there is a manifest file and the current package busts its limit
     * we signal it and terminate with an error.
     */

    if (hasExceededLimit) {
        console.log(
            `🔥🔥📦🔥🔥 Your package exceeds the limit set in ${MANIFEST_FILENAME}! ${packageSize} > ${limit}\nEither update the limit by using the --update-manifest flag or trim down your packed files!`,
        )
        return 1
    }

    /*
     * If there is a manifest file and the limit is not busted, we give
     * the user some feedback on how the current package compares with
     * the previous one.
     */

    if (packageSizeBytes > previousSizeBytes) {
        console.log(
            `📦 👀 Your package grew! ${packageSize} > ${previousSize} (Limit: ${limit})`,
        )
    } else if (packageSizeBytes < previousSizeBytes) {
        console.log(
            `📦 💯 Your package shrank! ${packageSize} < ${previousSize} (Limit: ${limit})`,
        )
    } else {
        console.log(
            `📦 Nothing to report! Your package is the same size as the latest manifest reports! (Limit: ${limit})`,
        )
    }
    return 0
}
