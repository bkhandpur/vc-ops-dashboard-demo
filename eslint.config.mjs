import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".deps/**",
      ".venv/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "node_modules/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    ...a11y.flatConfigs.recommended,
    files: ["**/*.tsx"],
    plugins: { ...a11y.flatConfigs.recommended.plugins, "react-hooks": hooks },
    rules: {
      ...a11y.flatConfigs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Modal first-input focus and backdrop dismissal supplement the existing Escape/focus handlers.
  { files: ["components/command-palette/**/*.tsx"], rules: { "jsx-a11y/no-autofocus": "off" } },
  {
    files: ["components/command-palette/CommandPalette.tsx", "components/search/GlobalSearch.tsx"],
    rules: { "jsx-a11y/no-noninteractive-element-interactions": "off" },
  },
);
