import { existsSync } from 'fs'
import { join, resolve } from 'path'

import logger from './logger'

export function assertInPackageRoot(cwd: string): void {
	const packagePath = resolve(join(cwd, 'package.json'))
	const packageJsonExists = existsSync(packagePath)

	if (!packageJsonExists) {
		logger.log('🤔 There is no package.json file here. Are you in the root directory of your project?')
		throw new Error('NOT_IN_PACKAGE_ROOT')
	}
}
