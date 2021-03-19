import { existsSync } from 'fs'
import { join, resolve } from 'path'

import {
    createOrUpdateManifest,
    getCurrentPackageStats,
    getPreviousPackageStats,
} from './utils'
import type { PackwatchArguments } from './index.d'
import { assertInPackageRoot } from './invariants'
import logger from './logger'

const MANIFEST_FILENAME = '.packwatch.json'

export default async function packwatch({
    cwd,
    isUpdatingManifest,
}: PackwatchArguments): Promise<void> {
    const manifestPath = resolve(join(cwd, MANIFEST_FILENAME))

    assertInPackageRoot(cwd)

    const currentStats = getCurrentPackageStats(cwd)

    /*
     * If there is no manifest file yet, we can use the current package stats as
     * a base to build one. The current package size becomes the limit.
     */

    if (!existsSync(manifestPath)) {
        createOrUpdateManifest({ manifestPath, current: currentStats })
        logger.warn(
            `📝 No Manifest to compare against! Current package stats written to ${MANIFEST_FILENAME}!\nPackage size (${currentStats.packageSize}) adopted as new limit.`,
        )

        if (!isUpdatingManifest) {
            logger.error(
                '❗ It looks like you ran PackWatch without a manifest. To prevent accidental passes in CI or hooks, packwatch will terminate with an error. If you are running packwatch for the first time in your project, this is expected!',
            )
            throw new Error('NO_MANIFEST_NO_UPDATE')
        }
        return
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
        logger.log(
            `📝 Updated the manifest! Package size: ${packageSize}, Limit: ${packageSize}`,
        )
        return
    }

    /*
     * If there is a manifest file and the current package busts its limit
     * we signal it and terminate with an error.
     */

    if (hasExceededLimit) {
        logger.error(
            `🔥🔥📦🔥🔥 Your package exceeds the limit set in ${MANIFEST_FILENAME}! ${packageSize} > ${limit}\nEither update the limit by using the --update-manifest flag or trim down your packed files!`,
        )
        throw new Error('PACKAGE_EXCEEDS_LIMIT')
    }

    /*
     * If there is a manifest file and the limit is not busted, we give
     * the user some feedback on how the current package compares with
     * the previous one.
     */

    if (packageSizeBytes > previousSizeBytes) {
        logger.log(
            `📦 👀 Your package grew! ${packageSize} > ${previousSize} (Limit: ${limit})`,
        )
    } else if (packageSizeBytes < previousSizeBytes) {
        logger.log(
            `📦 💯 Your package shrank! ${packageSize} < ${previousSize} (Limit: ${limit})`,
        )
    } else {
        logger.log(
            `📦 Nothing to report! Your package is the same size as the latest manifest reports! (Limit: ${limit})`,
        )
    }
    return
}
