import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

import type { Report } from '../index.d'
import packwatch from '..'

async function prepareWorkspace(): Promise<string> {
    const workspacePath = await fs.mkdtemp(`${tmpdir()}/`)
    return workspacePath
}

async function cleanUpWorkspace(paths: string[]): Promise<void> {
    await Promise.all(
        paths.map(async path => fs.rmdir(path, { recursive: true })),
    )
}

async function createFile(path: string, content: string): Promise<void> {
    await fs.writeFile(path, content)
}

async function createPackageJson(cwd: string): Promise<void> {
    const path = resolve(join(cwd, 'package.json'))
    await createFile(
        path,
        '{ "name": "wow", "version": "0.0.0", "files": ["!.packwatch.json"] }',
    )
}

async function createManifest(
    cwd: string,
    configuration: Report,
): Promise<void> {
    const path = resolve(join(cwd, '.packwatch.json'))
    await createFile(path, JSON.stringify(configuration))
}
describe('Packwatch', () => {
    let mockLogger
    let workspacePath
    beforeEach(() => {
        mockLogger = jest.spyOn(global.console, 'log').mockImplementation()
    })

    afterEach(async () => {
        jest.restoreAllMocks()

        if (workspacePath) {
            await cleanUpWorkspace([workspacePath])
            workspacePath = null
        }
    })

    it('warns the user and errors if run away from package.json', async () => {
        workspacePath = await prepareWorkspace()
        await packwatch({ cwd: workspacePath })

        expect(mockLogger.mock.calls).toHaveLength(1)
        expect(mockLogger.mock.calls[0][0]).toEqual(
            expect.stringMatching(
                'There is no package.json file here. Are you in the root directory of your project?',
            ),
        )
    })

    describe('without manifest', () => {
        it('generates the initial manifest properly', async () => {
            workspacePath = await prepareWorkspace()
            await createPackageJson(workspacePath)

            await expect(async () =>
                packwatch({ cwd: workspacePath }),
            ).rejects.toThrow()

            const generatedManifest = await fs.readFile(
                resolve(join(workspacePath, '.packwatch.json')),
                { encoding: 'utf8' },
            )

            expect(generatedManifest).toEqual(
                '{"limit":"160 B","packageSize":"160 B","unpackedSize":"68 B"}',
            )
        })

        it('outputs expected messaging', async () => {
            workspacePath = await prepareWorkspace()
            await createPackageJson(workspacePath)

            await expect(async () =>
                packwatch({ cwd: workspacePath }),
            ).rejects.toThrow()

            expect(mockLogger.mock.calls).toHaveLength(2)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /No Manifest to compare against! Current package stats written to \.packwatch\.json!\nPackage size \(\d+ B\) adopted as new limit\./,
                ),
            )
            expect(mockLogger.mock.calls[1][0]).toEqual(
                expect.stringMatching(
                    'It looks like you ran PackWatch without a manifest. To prevent accidental passes in CI or hooks, packwatch will terminate with an error. If you are running packwatch for the first time in your project, this is expected!',
                ),
            )
        })

        it('outputs expected messaging when not updating the manifest', async () => {
            workspacePath = await prepareWorkspace()

            await createPackageJson(workspacePath)

            await packwatch({ cwd: workspacePath, isUpdatingManifest: true })

            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /No Manifest to compare against! Current package stats written to \.packwatch\.json!\nPackage size \(\d+ B\) adopted as new limit\./,
                ),
            )
        })
    })

    describe('with manifest', () => {
        it('messages when the size is equal to the limit', async () => {
            workspacePath = await prepareWorkspace()

            await createPackageJson(workspacePath)
            await createManifest(workspacePath, {
                limit: '160B',
                packageSize: '160B',
                unpackedSize: '150B',
            })
            await packwatch({ cwd: workspacePath })
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /Nothing to report! Your package is the same size as the latest manifest reports! \(Limit: 160B\)/,
                ),
            )
        })

        it('messages when the size is lower than the limit (no growth)', async () => {
            workspacePath = await prepareWorkspace()

            await createPackageJson(workspacePath)
            await createManifest(workspacePath, {
                limit: '170B',
                packageSize: '160B',
                unpackedSize: '150B',
            })

            await packwatch({ cwd: workspacePath })
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /Nothing to report! Your package is the same size as the latest manifest reports! \(Limit: 170B\)/,
                ),
            )
        })
        it('messages when the size is lower than the limit (growth)', async () => {
            workspacePath = await prepareWorkspace()

            await createPackageJson(workspacePath)
            await createManifest(workspacePath, {
                limit: '180B',
                packageSize: '150B',
                unpackedSize: '140B',
            })

            await packwatch({ cwd: workspacePath })
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /Your package grew! \d+ B > 150B \(Limit: 180B\)/,
                ),
            )
        })
        it('messages when the size is lower than the limit (shrinkage)', async () => {
            workspacePath = await prepareWorkspace()

            await createPackageJson(workspacePath)
            await createManifest(workspacePath, {
                limit: '180B',
                packageSize: '170B',
                unpackedSize: '140B',
            })

            await packwatch({ cwd: workspacePath })
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /Your package shrank! \d+ B < 170B \(Limit: 180B\)/,
                ),
            )
        })
        it('messages when the size exceeds the limit', async () => {
            workspacePath = await prepareWorkspace()

            await createPackageJson(workspacePath)
            await createManifest(workspacePath, {
                limit: '10B',
                packageSize: '170B',
                unpackedSize: '140B',
            })

            await packwatch({ cwd: workspacePath })
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /Your package exceeds the limit set in \.packwatch\.json! \d+ B > 10B\nEither update the limit by using the --update-manifest flag or trim down your packed files!/,
                ),
            )
        })

        it('messages when updating the manifest', async () => {
            workspacePath = await prepareWorkspace()

            await createPackageJson(workspacePath)
            await createManifest(workspacePath, {
                limit: '10B',
                packageSize: '170B',
                unpackedSize: '140B',
            })

            await packwatch({ cwd: workspacePath, isUpdatingManifest: true })
            expect(mockLogger.mock.calls).toHaveLength(1)
            expect(mockLogger.mock.calls[0][0]).toEqual(
                expect.stringMatching(
                    /Updated the manifest! Package size: \d+ B, Limit: \d+ B/,
                ),
            )
        })
    })
})
