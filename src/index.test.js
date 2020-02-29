const childProcess = require('child_process')
const { readFileSync } = require('fs')

const mockFS = require('mock-fs')

jest.mock('child_process')
childProcess.spawnSync = jest.fn(() => ({ stderr: mockPackOutput }))

const {
    DIGEST_FILENAME,
    convertSizeToBytes,
    getCurrentPackageStats,
    getPreviousPackageStats,
    createOrUpdateDigest,
} = require('./helpers')

const mockPackageSize = '1.1 kB'
const mockUnpackedSize = '9000 kB'

const mockPackOutput = `
npm notice
npm notice 📦  footprint@0.0.0
npm notice === Tarball Contents ===
npm notice 732B  package.json
npm notice 1.8kB dist/helpers.js
npm notice 1.9kB dist/index.js
npm notice === Tarball Details ===
npm notice name:          footprint
npm notice version:       0.0.0
npm notice filename:      footprint-0.0.0.tgz
npm notice package size:  ${mockPackageSize}
npm notice unpacked size: ${mockUnpackedSize}
npm notice shasum:        bdf33d471543cd8126338a82a27b16a9010b8dbd
npm notice integrity:     sha512-ZZvTg9GVcJw8J[...]bkE0xlqQhlt4Q==
npm notice total files:   3
npm notice
    `
describe('Helpers', () => {
    beforeEach(() => {
        mockFS.restore()
        jest.restoreAllMocks()
    })

    afterAll(mockFS.restore)

    describe('Size string conversion', () => {
        it.each`
            sizeString  | expectedValue
            ${'1 B'}    | ${1}
            ${'1.1 B'}  | ${1.1}
            ${'1 kB'}   | ${1000}
            ${'1.1kB'}  | ${1100}
            ${'1 mB'}   | ${1000000}
            ${'1.1 mB'} | ${1100000}
        `(
            'converts $sizeString properly to $expectedValue bytes',
            ({ sizeString, expectedValue }) => {
                expect(convertSizeToBytes(sizeString)).toEqual(expectedValue)
            },
        )
    })

    describe('Current package statistics', () => {
        it('constructs the current package report properly', () => {
            const packageSizeBytes = 1100
            const unpackedSizeBytes = 9000000

            expect(getCurrentPackageStats()).toEqual({
                packageSize: mockPackageSize,
                packageSizeBytes,
                unpackedSize: mockUnpackedSize,
                unpackedSizeBytes,
            })
        })
    })

    describe('Previous package statistics', () => {
        it('constructs the previous package report properly', () => {
            const packageSize = '0.9 kB'
            const packageSizeBytes = 900
            const unpackedSize = '90 kB'
            const unpackedSizeBytes = 90000
            const limit = '1 kB'
            const limitBytes = 1000
            const mockReport = { packageSize, unpackedSize, limit }
            mockFS({ [DIGEST_FILENAME]: JSON.stringify(mockReport) })

            expect(getPreviousPackageStats()).toEqual({
                packageSize,
                packageSizeBytes,
                unpackedSize,
                unpackedSizeBytes,
                limit,
                limitBytes,
            })
        })

        it('returns an empty digest if it fails to reads the digest file', () => {
            mockFS({
                [DIGEST_FILENAME]: 'not valid JSON',
            })

            expect(getPreviousPackageStats()).toEqual({})
        })
    })

    describe('Creating or updating the digest', () => {
        const currentStats = {
            packageSize: '1 kB',
            unpackedSize: '10 kB',
        }

        const previousDigest = {
            limit: '2 kB',
            packageSize: '1.5 kB',
        }
        it('creates a digest from the current data if no previous data is provided', () => {
            mockFS({})

            createOrUpdateDigest({ current: currentStats })

            const writtenDigest = readFileSync(DIGEST_FILENAME, {
                encoding: 'utf-8',
            })

            expect(JSON.parse(writtenDigest)).toEqual({
                packageSize: currentStats.packageSize,
                unpackedSize: currentStats.unpackedSize,
                limit: currentStats.packageSize,
            })
        })

        it('updates the previous digest sizes if previous data exists', () => {
            mockFS({
                [DIGEST_FILENAME]: JSON.stringify(previousDigest),
            })

            createOrUpdateDigest({
                current: currentStats,
                previous: previousDigest,
                updateLimit: false,
            })

            const writtenDigest = readFileSync(DIGEST_FILENAME, {
                encoding: 'utf-8',
            })

            expect(JSON.parse(writtenDigest)).toEqual({
                packageSize: currentStats.packageSize,
                unpackedSize: currentStats.unpackedSize,
                limit: previousDigest.limit,
            })
        })

        it('updates the previous digest sizes and limit if previous data exists and updateLimit is set', () => {
            mockFS({
                [DIGEST_FILENAME]: JSON.stringify(previousDigest),
            })

            createOrUpdateDigest({
                current: currentStats,
                previous: previousDigest,
                updateLimit: true,
            })

            const writtenDigest = readFileSync(DIGEST_FILENAME, {
                encoding: 'utf-8',
            })

            expect(JSON.parse(writtenDigest)).toEqual({
                packageSize: currentStats.packageSize,
                unpackedSize: currentStats.unpackedSize,
                limit: currentStats.packageSize,
            })
        })
    })
})
