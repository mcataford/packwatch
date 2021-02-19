#!/usr/bin/env node

import runPackwatch from '.'

const isUpdatingManifest = process.argv.includes('--update-manifest')
const cwd = process.cwd()
const processExit = runPackwatch({ cwd, isUpdatingManifest })
process.exit(processExit)
