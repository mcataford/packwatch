import { spawnSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

const PACKAGE_SIZE_PATT = /package size:\s+([0-9]+\.?[0-9]*\s+[A-Za-z]+)/g
const UNPACKED_SIZE_PATT = /unpacked size:\s+([0-9]+\.?[0-9]*\s+[A-Za-z]+)/g
const SIZE_SUFFIX_PATT = /([A-Za-z]+)/
const SIZE_MAGNITUDE_PATT = /([0-9]+\.?[0-9]*)/

export const MANIFEST_FILENAME = '.packwatch.json'

type Report = {
    packageSize: string
    unpackedSize: string
    packageSizeBytes?: number
    unpackedSizeBytes?: number
}

type Digest = {
    limit: string
    packageSize: string
}

export function convertSizeToBytes(sizeString: string): number {
    const sizeSuffix = SIZE_SUFFIX_PATT.exec(sizeString)[1]
    const sizeMagnitude = SIZE_MAGNITUDE_PATT.exec(sizeString)[1]

    let multiplier = 1

    if (sizeSuffix === 'kB') multiplier = 1000
    else if (sizeSuffix === 'mB') {
        multiplier = 1000000
    }

    return multiplier * parseFloat(sizeMagnitude)
}

export function getCurrentPackageStats(): Report {
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

export function getPreviousPackageStats(): Report | null {
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

export function createOrUpdateManifest({
    previous,
    current,
    updateLimit = false,
}: {
    previous?: Digest
    current: Report
    updateLimit?: boolean
}) {
    const { limit } = previous || {}
    const { packageSize, unpackedSize } = current

    const newManifest = {
        limit: updateLimit ? packageSize : limit || packageSize,
        packageSize: packageSize,
        unpackedSize: unpackedSize,
    }

    writeFileSync(MANIFEST_FILENAME, JSON.stringify(newManifest))
}
