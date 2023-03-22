module.exports = {
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    extends: [
        "@tophat/eslint-config/base",
        "@tophat/eslint-config/jest",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    parserOptions: {
        project: ['./tsconfig.eslint.json']
    }
}
