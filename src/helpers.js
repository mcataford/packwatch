const { spawnSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')

const PACKAGE_SIZE_PATT = /package size:\s+([0-9]+\.?[0-9]*\s+[A-Za-z]+)/g
const UNPACKED_SIZE_PATT = /unpacked size:\s+([0-9]+\.?[0-9]*\s+[A-Za-z]+)/g
const SIZE_SUFFIX_PATT = /([A-Za-z]+)/
const SIZE_MAGNITUDE_PATT = /([0-9]+\.?[0-9]*)/
const DIGEST_FILENAME = '.packwatch.json'

const FS_OPTIONS = { encoding: 'utf-8' }

function convertSizeToBytes(sizeString) {
    const sizeSuffix = SIZE_SUFFIX_PATT.exec(sizeString)[1]
    const sizeMagnitude = SIZE_MAGNITUDE_PATT.exec(sizeString)[1]

    let multiplier = 1

    if (sizeSuffix === 'kB') multiplier = 1000
    else if (sizeSuffix === 'mB') {
        multiplier = 1000000
    }

    return multiplier * parseFloat(sizeMagnitude)
}

function getCurrentPackageStats() {
    const { stderr } = spawnSync('npm', ['pack', '--dry-run'], FS_OPTIONS)
    const packageSize = PACKAGE_SIZE_PATT.exec(stderr)[1]
    const unpackedSize = UNPACKED_SIZE_PATT.exec(stderr)[1]

    return {
        packageSize,
        unpackedSize,
        packageSizeBytes: convertSizeToBytes(packageSize),
        unpackedSizeBytes: convertSizeToBytes(unpackedSize),
    }
}

function getPreviousPackageStats() {
    try {
        const currentDigest = readFileSync(DIGEST_FILENAME, FS_OPTIONS)
        const parsedDigest = JSON.parse(currentDigest)
        return {
            ...parsedDigest,
            packageSizeBytes: convertSizeToBytes(parsedDigest.packageSize),
            unpackedSizeBytes: convertSizeToBytes(parsedDigest.unpackedSize),
            limitBytes: convertSizeToBytes(parsedDigest.limit),
        }
    } catch (e) {
        return {}
    }
}

function createOrUpdateDigest({ previous, current, updateLimit = false }) {
    const { limit } = previous || {}
    const { packageSize, unpackedSize } = current

    const newDigest = {
        limit: updateLimit ? packageSize : limit || packageSize,
        packageSize: packageSize,
        unpackedSize: unpackedSize,
    }

    writeFileSync(DIGEST_FILENAME, JSON.stringify(newDigest))
}

module.exports = {
    createOrUpdateDigest,
    getPreviousPackageStats,
    getCurrentPackageStats,
    convertSizeToBytes,
    DIGEST_FILENAME,
}
