#!/usr/bin/env node

import packwatch from '.'

const isUpdatingManifest = process.argv.includes('--update-manifest')
const cwd = process.cwd()
packwatch({ cwd, isUpdatingManifest })
	.catch(() => process.exit(1))
	.then(() => process.exit(0))
