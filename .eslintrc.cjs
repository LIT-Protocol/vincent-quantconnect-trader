/**
 * Eslint config applies to all packages - except each package must define mocha-specific overrides
 * due to complexity in identifying dependencies and their sources from parent package.json files
 */
module.exports = {
  root: true,
  env: { node: true },
  parserOptions: {
    project: true,
  },
  plugins: ['import', 'sort-destructure-keys', 'sort-keys-plus'],
  overrides: [
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      extends: [
        'eslint:recommended',
        'airbnb-base',
        'airbnb-typescript/base',
        'plugin:import/recommended',
        'plugin:import/typescript',
        'plugin:typescript-sort-keys/recommended',
        'prettier',
      ],
      settings: {
        'import/resolver': {
          node: {
            extensions: ['.js', '.jsx'],
          },
          typescript: {
            extensions: ['.ts', '.tsx'],
          },
        },
        'import/internal-regex': '^@lit-protocol/',
        'import/parsers': {
          '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
        'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
      },
      rules: {
        'no-console': 'error',
        'import/prefer-default-export': ['off'],
        'import/no-default-export': ['error'],
        'import/no-relative-packages': ['error'],
        'import/no-duplicates': ['error'],
        'import/no-unresolved': ['error'],
        'import/no-extraneous-dependencies': ['off'],
        'import/order': [
          'error',
          {
            alphabetize: {
              order: 'asc',
              caseInsensitive: true,
            },
            'newlines-between': 'always',
            groups: [
              'builtin',
              'external',
              'internal',
              ['sibling', 'parent', 'index'],
              'object',
              'type',
            ],
          },
        ],
        'typescript-sort-keys/interface': 'error',
        'typescript-sort-keys/string-enum': 'error',
        'sort-keys-plus/sort-keys': [
          'error',
          'asc',
          {
            caseSensitive: false,
            natural: true,
            minKeys: 2,
            allowLineSeparatedGroups: true,
            shorthand: 'first',
          },
        ],
        'sort-destructure-keys/sort-destructure-keys': ['error', { caseSensitive: false }],
        'class-methods-use-this': ['off'],
        '@typescript-eslint/naming-convention': ['off'],
        'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
        'no-underscore-dangle': ['off'],
        'no-useless-escape': ['off'],
        'no-restricted-syntax': [
          'error',
          {
            selector: 'ForInStatement',
            message:
              'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
          },
          {
            selector: 'LabeledStatement',
            message:
              'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
          },
          {
            selector: 'WithStatement',
            message:
              '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
          },
        ],
      },
    },
  ],
};
