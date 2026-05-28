import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig } from "eslint/config";

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks, unicorn },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "AwaitExpression > ImportExpression", message: "Use a static import instead of await import()." },
        { selector: "CallExpression > MemberExpression.callee[property.name='then']", message: "Use async/await instead of .then(). For fire-and-forget, wrap in `void (async () => { ... })()`." },
        { selector: "TryStatement[finalizer]", message: "Avoid try/finally. Put cleanup after the try/catch block — it runs in both paths anyway." },
        { selector: "TSTypeReference > Identifier[name='Omit']", message: "Don't use Omit<>. Define an explicit base type that other types extend." },
        { selector: "TSExpressionWithTypeArguments > Identifier[name='Omit']", message: "Don't use Omit<> in extends. Define an explicit base type that other types extend." },
        { selector: "JSXExpressionContainer CallExpression[callee.type='ArrowFunctionExpression']", message: "Don't inline an IIFE in JSX. Extract the logic into a named component or compute the value above the return statement." },
        { selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(confirm|alert|prompt)$/]", message: "Don't use window.confirm/alert/prompt. Use the in-app ConfirmModal (src/components/ConfirmModal.tsx) or build a styled in-app dialog." },
        { selector: "CallExpression[callee.name=/^(confirm|alert|prompt)$/]", message: "Don't use the bare confirm/alert/prompt globals. Use the in-app ConfirmModal (src/components/ConfirmModal.tsx) or build a styled in-app dialog." },
      ],
      "unicorn/no-nested-ternary": "error",
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    },
  },
);
