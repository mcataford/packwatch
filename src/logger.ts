export default {
    log: (...args: unknown[]): void => {
        console.log(...args)
    },
    warn: (...args: unknown[]): void => {
        console.warn(...args)
    },
    error: (...args: unknown[]): void => {
        console.error(...args)
    },
}
