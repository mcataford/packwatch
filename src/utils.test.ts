import { convertSizeToBytes } from './utils'

describe('utils', () => {
    it.each`
        initialSize | expectedSize
        ${'1 B'}    | ${1}
        ${'1 kB'}   | ${1000}
        ${'1 mB'}   | ${1000000}
    `(
        'converts sizes properly ($initialSize -> $expectedSize)',
        ({ initialSize, expectedSize }) => {
            expect(convertSizeToBytes(initialSize)).toEqual(expectedSize)
        },
    )
})
