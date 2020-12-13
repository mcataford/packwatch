#!/usr/bin/env node

import runPackwatch from '.'

const isUpdatingManifest = process.argv.includes('--update-manifest')
const processExit = runPackwatch({ isUpdatingManifest })
process.exit(processExit)
