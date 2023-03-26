import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

import packwatch from '../src'

import type { Report } from '../src/types'

let workspace: string | null

function getActualPackageSizeByNodeVersion(nodeVersion: string): string {
	if (nodeVersion.startsWith('v14')) return '160'
	else if (nodeVersion.startsWith('v16')) return '157'
	else if (nodeVersion.startsWith('v18')) return '157'

	return 'unknown'
}

async function prepareWorkspace(): Promise<string> {
	const workspacePath = await fs.mkdtemp(`${tmpdir()}/`)
	workspace = workspacePath
	return workspacePath
}

async function cleanUpWorkspace(paths: string[]): Promise<void> {
	await Promise.all(paths.map(async (path) => fs.rmdir(path, { recursive: true })))
}

async function createFile(path: string, content: string): Promise<void> {
	await fs.writeFile(path, content)
}

async function createPackageJson(cwd: string): Promise<void> {
	const path = resolve(join(cwd, 'package.json'))
	await createFile(path, '{ "name": "wow", "version": "0.0.0", "files": ["!.packwatch.json"] }')
}

async function createManifest(cwd: string, configuration: Report): Promise<void> {
	const path = resolve(join(cwd, '.packwatch.json'))
	await createFile(path, JSON.stringify(configuration))
}

describe('Packwatch', () => {
	const actualSize = getActualPackageSizeByNodeVersion(process.version)
	afterEach(async () => {
		jest.restoreAllMocks()

		if (workspace) {
			await cleanUpWorkspace([workspace])
			workspace = null
		}
	})

	it('warns the user and errors if run away from package.json', async () => {
		const workspacePath = await prepareWorkspace()
		const mockLogger = jest.spyOn(console, 'log')

		await expect(async () => packwatch({ cwd: workspacePath })).rejects.toThrow('NOT_IN_PACKAGE_ROOT')

		expect(mockLogger.mock.calls).toHaveLength(1)
		expect(mockLogger.mock.calls[0][0]).toEqual(
			expect.stringMatching('There is no package.json file here. Are you in the root directory of your project?'),
		)
	})

	describe('without manifest', () => {
		it('generates the initial manifest properly', async () => {
			const workspacePath = await prepareWorkspace()
			await createPackageJson(workspacePath)

			await expect(async () => packwatch({ cwd: workspacePath })).rejects.toThrow('NO_MANIFEST_NO_UPDATE')

			const generatedManifest = await fs.readFile(resolve(join(workspacePath, '.packwatch.json')), { encoding: 'utf8' })

			expect(generatedManifest).toBe(
				`{"limit":"${actualSize} B","packageSize":"${actualSize} B","unpackedSize":"68 B"}`,
			)
		})

		it('outputs expected messaging', async () => {
			const workspacePath = await prepareWorkspace()
			const mockWarn = jest.spyOn(console, 'warn')
			const mockError = jest.spyOn(console, 'error')
			await createPackageJson(workspacePath)

			await expect(async () => packwatch({ cwd: workspacePath })).rejects.toThrow()

			expect(mockWarn.mock.calls).toHaveLength(1)
			expect(mockWarn.mock.calls[0][0]).toEqual(
				expect.stringMatching(
					/No Manifest to compare against! Current package stats written to \.packwatch\.json!\nPackage size \(\d+ B\) adopted as new limit\./,
				),
			)
			expect(mockError.mock.calls).toHaveLength(1)
			expect(mockError.mock.calls[0][0]).toEqual(
				expect.stringMatching(
					'It looks like you ran PackWatch without a manifest. To prevent accidental passes in CI or hooks, packwatch will terminate with an error. If you are running packwatch for the first time in your project, this is expected!',
				),
			)
		})

		it('outputs expected messaging when not updating the manifest', async () => {
			const mockWarn = jest.spyOn(console, 'warn')
			const workspacePath = await prepareWorkspace()

			await createPackageJson(workspacePath)

			await packwatch({ cwd: workspacePath, isUpdatingManifest: true })

			expect(mockWarn.mock.calls).toHaveLength(1)
			expect(mockWarn.mock.calls[0][0]).toEqual(
				expect.stringMatching(
					/No Manifest to compare against! Current package stats written to \.packwatch\.json!\nPackage size \(\d+ B\) adopted as new limit\./,
				),
			)
		})
	})

	describe('with manifest', () => {
		it('messages when the size is equal to the limit', async () => {
			const workspacePath = await prepareWorkspace()
			const mockLogger = jest.spyOn(console, 'log')
			await createPackageJson(workspacePath)
			await createManifest(workspacePath, {
				limit: `${actualSize}B`,
				packageSize: `${actualSize}B`,
				packageSizeBytes: Number(actualSize),
				unpackedSize: '150B',
				unpackedSizeBytes: 150,
			})
			await packwatch({ cwd: workspacePath })
			expect(mockLogger.mock.calls).toHaveLength(1)
			expect(mockLogger.mock.calls[0][0]).toEqual(
				expect.stringMatching(/Nothing to report! Your package is the same size as the latest manifest reports!/),
			)
		})

		it('messages when the size is lower than the limit (no growth)', async () => {
			const workspacePath = await prepareWorkspace()
			const mockLogger = jest.spyOn(console, 'log')
			await createPackageJson(workspacePath)
			await createManifest(workspacePath, {
				limit: '170B',
				packageSize: `${actualSize}B`,
				packageSizeBytes: Number(actualSize),
				unpackedSize: '150B',
				unpackedSizeBytes: 150,
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
			const workspacePath = await prepareWorkspace()
			const mockLogger = jest.spyOn(console, 'log')
			await createPackageJson(workspacePath)
			await createManifest(workspacePath, {
				limit: '180B',
				packageSize: '150B',
				packageSizeBytes: 150,
				unpackedSize: '140B',
				unpackedSizeBytes: 140,
			})

			await packwatch({ cwd: workspacePath })
			expect(mockLogger.mock.calls).toHaveLength(1)
			expect(mockLogger.mock.calls[0][0]).toEqual(
				expect.stringMatching(/Your package grew! \d+ B > 150B \(Limit: 180B\)/),
			)
		})
		it('messages when the size is lower than the limit (shrinkage)', async () => {
			const workspacePath = await prepareWorkspace()
			const mockLogger = jest.spyOn(console, 'log')
			await createPackageJson(workspacePath)
			await createManifest(workspacePath, {
				limit: '180B',
				packageSize: '170B',
				packageSizeBytes: 170,
				unpackedSize: '140B',
				unpackedSizeBytes: 140,
			})

			await packwatch({ cwd: workspacePath })
			expect(mockLogger.mock.calls).toHaveLength(1)
			expect(mockLogger.mock.calls[0][0]).toEqual(
				expect.stringMatching(/Your package shrank! \d+ B < 170B \(Limit: 180B\)/),
			)
		})
		it('messages when the size exceeds the limit', async () => {
			const workspacePath = await prepareWorkspace()
			const mockError = jest.spyOn(console, 'error')
			await createPackageJson(workspacePath)
			await createManifest(workspacePath, {
				limit: '10B',
				packageSize: '170B',
				packageSizeBytes: 170,
				unpackedSize: '140B',
				unpackedSizeBytes: 140,
			})

			await expect(async () => packwatch({ cwd: workspacePath })).rejects.toThrow('PACKAGE_EXCEEDS_LIMIT')
			expect(mockError.mock.calls).toHaveLength(1)
			expect(mockError.mock.calls[0][0]).toEqual(
				expect.stringMatching(
					/Your package exceeds the limit set in \.packwatch\.json! \d+ B > 10B\nEither update the limit by using the --update-manifest flag or trim down your packed files!/,
				),
			)
		})

		it('messages when updating the manifest', async () => {
			const workspacePath = await prepareWorkspace()
			const mockLogger = jest.spyOn(console, 'log')
			await createPackageJson(workspacePath)
			await createManifest(workspacePath, {
				limit: '10B',
				packageSize: '170B',
				packageSizeBytes: 170,
				unpackedSize: '140B',
				unpackedSizeBytes: 140,
			})

			await packwatch({ cwd: workspacePath, isUpdatingManifest: true })
			expect(mockLogger.mock.calls).toHaveLength(1)
			expect(mockLogger.mock.calls[0][0]).toEqual(
				expect.stringMatching(/Updated the manifest! Package size: \d+ B, Limit: \d+ B/),
			)
		})
	})
})
