module.exports = {
    transformIgnorePatterns: ['.test.js'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
}
