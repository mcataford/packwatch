#!/usr/bin/env node

const { existsSync } = require('fs')

const {
    MANIFEST_FILENAME,
    getCurrentPackageStats,
    getPreviousPackageStats,
    createOrUpdateManifest,
} = require('./helpers')

if (!existsSync('package.json')) {
    console.log(
        '🤔 There is no package.json file here. Are you in the root directory of your project?',
    )
    process.exit(1)
}

const isUpdatingManifest = process.argv.includes('--update-manifest')

const currentStats = getCurrentPackageStats()

/*
 * If there is no manifest file yet, we can use the current package stats as
 * a base to build one. The current package size becomes the limit.
 */

if (!existsSync(MANIFEST_FILENAME)) {
    createOrUpdateManifest({ current: currentStats })
    console.log(
        `📝 No Manifest to compare against! Current package stats written to ${MANIFEST_FILENAME}!`,
    )
    console.log(
        `Package size (${currentStats.packageSize}) adopted as new limit.`,
    )
    // If the update flag wasn't specified, exit with a non-zero code so we
    // don't "accidentally" pass CI builds if the manifest didn't exist
    process.exit(isUpdatingManifest ? 0 : 1)
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
    process.exit(0)
}

/*
 * If there is a manifest file and the current package busts its limit
 * we signal it and terminate with an error.
 */

if (hasExceededLimit) {
    console.log(
        `🔥🔥📦🔥🔥 Your package exceeds the limit set in ${MANIFEST_FILENAME}! ${packageSize} > ${limit}`,
    )
    console.log(
        'Either update the limit by using the --update-manifest flag or trim down your packed files!',
    )
    process.exit(1)
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
