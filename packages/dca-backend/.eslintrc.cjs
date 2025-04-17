module.exports = {
  env: {
    node: true,
  },
  extends: ['../../.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: { project: true },
  ignorePatterns: ['.eslintrc.cjs', 'jest.config.js'],
  overrides: [
    {
      files: ['test.spec.ts'],
      env: { jest: true },
    },
  ],
};
