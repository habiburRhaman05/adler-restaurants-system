/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2023: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2023,
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  settings: {
    "import/resolver": {
      typescript: true,
    },
  },
  ignorePatterns: ["dist", "node_modules", "generated", "*.js"],
  rules: {
    "import/order": [
      "error",
      {
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      },
    ],
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksVoidReturn: false, checksConditionals: true },
    ],
  },
};
