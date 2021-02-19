import { existsSync } from 'fs'
import { join, resolve } from 'path'

import {
    createOrUpdateManifest,
    getCurrentPackageStats,
    getPreviousPackageStats,
} from './utils'

const MANIFEST_FILENAME = '.packwatch.json'

export default function run({
    cwd,
    isUpdatingManifest,
}: {
    cwd?: string
    isUpdatingManifest?: boolean
}): number {
    const packageJsonPath = resolve(join(cwd, 'package.json'))
    const manifestPath = resolve(join(cwd, MANIFEST_FILENAME))

    if (!existsSync(packageJsonPath)) {
        console.log(
            '🤔 There is no package.json file here. Are you in the root directory of your project?',
        )
        return 1
    }

    const currentStats = getCurrentPackageStats(cwd)

    /*
     * If there is no manifest file yet, we can use the current package stats as
     * a base to build one. The current package size becomes the limit.
     */

    if (!existsSync(manifestPath)) {
        createOrUpdateManifest({ manifestPath, current: currentStats })
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

    const previousStats = getPreviousPackageStats(cwd)
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
            manifestPath,
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
