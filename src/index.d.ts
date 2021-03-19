export type PackwatchArguments = {
    cwd?: string
    isUpdatingManifest?: boolean
}

export type Report = {
    packageSize: string
    unpackedSize?: string
    packageSizeBytes?: number
    unpackedSizeBytes?: number
    limit?: string
    limitBytes?: number
}
