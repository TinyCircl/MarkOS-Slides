import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "no-constant-condition": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-control-regex": "off",
      "no-useless-assignment": "warn",
    },
  },
  {
    files: ["test/**/*.mjs"],
    languageOptions: {
      globals: {
        fetch: "readonly",
      },
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".markos-*/",
      "packages/*/node_modules/",
    ],
  },
];
