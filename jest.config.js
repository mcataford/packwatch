module.exports = {
    transformIgnorePatterns: ['.test.js'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts'],
}
