import * as childProcess from 'child_process'
import { promises as fs, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

import mockFS from 'mock-fs'

import runPackwatch from '..'

//jest.mock('child_process')

function getPackOutput({ packageSize, unpackedSize }) {
    return `
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
npm notice package size:  ${packageSize}
npm notice unpacked size: ${unpackedSize}
npm notice shasum:        bdf33d471543cd8126338a82a27b16a9010b8dbd
npm notice integrity:     sha512-ZZvTg9GVcJw8J[...]bkE0xlqQhlt4Q==
npm notice total files:   3
npm notice
    `
}

async function prepareWorkspace(): Promise<string> {
    const workspacePath = await fs.mkdtemp(`${tmpdir()}/`, { recursive: true })
    return workspacePath
}

async function cleanUpWorkspace(paths: string[]): Promise<void> {
    return Promise.all(
        paths.map(async path => fs.rmdir(path, { recursive: true })),
    )
}

async function createFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content)
}

/*
function getManifest() {
  try {
    return JSON.parse(readFileSync(".packwatch.json", { encoding: "utf8" }))
  } catch {
  }
}

function setupMockFS({
  hasPackageJSON,
  hasManifest,
  manifestLimit,
  manifestSize,
}) {
  const fs = {}

  if (hasPackageJSON) fs["package.json"] = "{}"

  if (hasManifest)
    fs[".packwatch.json"] = JSON.stringify({
      unpackedSize: "0.5 B",
      limitBytes: manifestLimit,
      limit: `${manifestLimit}  B`,
      packageSize: `${manifestSize}  B`,
      packageSizeBytes: manifestSize,
    })
  mockFS(fs)
}
*/
describe('Packwatch', () => {
    let mockLogger
    let workspacePath
    beforeEach(() => {
        //mockFS({})
        //mockLogger = jest.spyOn(global.console, 'log').mockImplementation()
    })

    afterEach(async () => {
        jest.restoreAllMocks()

        if (workspacePath) {
            await cleanUpWorkspace([workspacePath])
            workspacePath = null
        }
    })

    /*
  afterAll(mockFS.restore)
  */

    it.skip('warns the user and errors if run away from package.json', async () => {
        workspacePath = await prepareWorkspace()
        runPackwatch({ cwd: workspacePath })

        expect(mockLogger.mock.calls).toHaveLength(1)
        expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(
            '"🤔 There is no package.json file here. Are you in the root directory of your project?"',
        )
    })

    describe('without manifest', () => {
        /*
    beforeEach(() => {
      setupMockFS({ hasPackageJSON: true })
    })
   */

        it('generates the initial manifest properly', async () => {
            workspacePath = await prepareWorkspace()

            await createFile(
                resolve(join(workspacePath, 'package.json')),
                '{ "name": "wow", "version": "0.0.0" }',
            )

            runPackwatch({ cwd: workspacePath })

            const generatedManifest = await fs.readFile(
                resolve(join(workspacePath, '.packwatch.json')),
                { encoding: 'utf8' },
            )

            expect(generatedManifest).toMatchInlineSnapshot(
                '"{\\"limit\\":\\"138 B\\",\\"packageSize\\":\\"138 B\\",\\"unpackedSize\\":\\"37 B\\"}"',
            )
        })

        /*it.each(["1 B", "1.1 B", "1 kB", "1.1 kB", "1 mB", "1.1 mB"])(
      "generates the initial manifest properly (size = %s)",
      (mockSize) => {
        jest.spyOn(childProcess, "spawnSync").mockReturnValue({
          stderr: getPackOutput({
            packageSize: mockSize,
            unpackedSize: mockSize,
          }),
        })
        const returnCode = runPackwatch({})
        const manifest = getManifest()
        expect(returnCode).toEqual(1)
        expect(manifest).toEqual({
          limit: mockSize,
          packageSize: mockSize,
          unpackedSize: mockSize,
        })
      }
    )*/

        it.skip('outputs expected messaging', () => {
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '1 B',
                    unpackedSize: '2 B',
                }),
            })

            runPackwatch({})

            expect(mockLogger.mock.calls).toHaveLength(2)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(`
        "📝 No Manifest to compare against! Current package stats written to .packwatch.json!
        Package size (1 B) adopted as new limit."
      `)
            expect(mockLogger.mock.calls[1][0]).toMatchInlineSnapshot(
                '"❗ It looks like you ran PackWatch without a manifest. To prevent accidental passes in CI or hooks, packwatch will terminate with an error. If you are running packwatch for the first time in your project, this is expected!"',
            )
        })

        it.skip('outputs expected messaging when not updating the manifest', () => {
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '1 B',
                    unpackedSize: '2 B',
                }),
            })

            runPackwatch({ isUpdatingManifest: true })

            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(`
        "📝 No Manifest to compare against! Current package stats written to .packwatch.json!
        Package size (1 B) adopted as new limit."
      `)
        })
    })

    describe.skip('with manifest', () => {
        it('messages when the size is equal to the limit', () => {
            setupMockFS({
                hasPackageJSON: true,
                hasManifest: true,
                manifestLimit: 1,
                manifestSize: 1,
            })
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '1 B',
                    unpackedSize: '2 B',
                }),
            })
            runPackwatch({})
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(
                '"📦 Nothing to report! Your package is the same size as the latest manifest reports! (Limit: 1  B)"',
            )
        })

        it('messages when the size is lower than the limit (no growth)', () => {
            setupMockFS({
                hasPackageJSON: true,
                hasManifest: true,
                manifestLimit: 5,
                manifestSize: 1,
            })
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '1 B',
                    unpackedSize: '2 B',
                }),
            })
            runPackwatch({})
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(
                '"📦 Nothing to report! Your package is the same size as the latest manifest reports! (Limit: 5  B)"',
            )
        })
        it('messages when the size is lower than the limit (growth)', () => {
            setupMockFS({
                hasPackageJSON: true,
                hasManifest: true,
                manifestLimit: 5,
                manifestSize: 2,
            })
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '3 B',
                    unpackedSize: '2 B',
                }),
            })
            runPackwatch({})
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(
                '"📦 👀 Your package grew! 3 B > 2  B (Limit: 5  B)"',
            )
        })
        it('messages when the size is lower than the limit (shrinkage)', () => {
            setupMockFS({
                hasPackageJSON: true,
                hasManifest: true,
                manifestLimit: 5,
                manifestSize: 2,
            })
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '1 B',
                    unpackedSize: '2 B',
                }),
            })
            runPackwatch({})
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(
                '"📦 💯 Your package shrank! 1 B < 2  B (Limit: 5  B)"',
            )
        })
        it('messages when the size exceeds the limit', () => {
            setupMockFS({
                hasPackageJSON: true,
                hasManifest: true,
                manifestLimit: 0.5,
                manifestSize: 0.5,
            })
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '1 B',
                    unpackedSize: '2 B',
                }),
            })
            runPackwatch({})
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(`
        "🔥🔥📦🔥🔥 Your package exceeds the limit set in .packwatch.json! 1 B > 0.5  B
        Either update the limit by using the --update-manifest flag or trim down your packed files!"
      `)
        })

        it('messages when updating the manifest', () => {
            setupMockFS({
                hasPackageJSON: true,
                hasManifest: true,
                manifestLimit: 0.5,
                manifestSize: 0.5,
            })
            jest.spyOn(childProcess, 'spawnSync').mockReturnValue({
                stderr: getPackOutput({
                    packageSize: '1 B',
                    unpackedSize: '2 B',
                }),
            })
            runPackwatch({ isUpdatingManifest: true })
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toMatchInlineSnapshot(
                '"📝 Updated the manifest! Package size: 1 B, Limit: 1 B"',
            )
        })
    })
})
