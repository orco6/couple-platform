import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Lint rules.
 *
 * The boundary rules at the bottom are architectural, not stylistic: they keep
 * client components from importing server-only modules, and keep the core
 * platform from depending on the sample domain's internals.
 */
const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
      'next-env.d.ts',
      '.tmp/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      // Raw HTML injection is an XSS vector. There is no legitimate use in this app.
      'react/no-danger': 'error',
      // A <form> without method="post" submits as GET if someone presses Enter before
      // hydration (slow phone, slow network): passwords and personal data land in the URL,
      // browser history and server logs. Verified with JavaScript disabled.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='form']:not(:has(JSXAttribute[name.name='method'][value.value='post']))",
          message: 'Every <form> needs method="post" so a submit before hydration never puts field values in the URL.',
        },
        // Colours come from semantic tokens (bg-surface, text-ink-muted…) so a brand can change them.
        // Arbitrary colour classes bypass the brand layer (a toast shipped with two hex colours this way).
        {
          selector: 'Literal[value=/(bg|text|border|fill|stroke|ring|outline|from|to|via|decoration|caret|accent|shadow|divide)-\\[(#|rgb|hsl|oklch)/]',
          message: 'Use a semantic colour token (see src/core/ui/styles/foundation.css and src/brand/theme.css), not a raw colour class.',
        },
        {
          selector: 'TemplateElement[value.raw=/(bg|text|border|fill|stroke|ring|outline|from|to|via|decoration|caret|accent|shadow|divide)-\\[(#|rgb|hsl|oklch)/]',
          message: 'Use a semantic colour token (see src/core/ui/styles/foundation.css and src/brand/theme.css), not a raw colour class.',
        },
      ],
    },
  },
  {
    // Printed documents use fixed paper greys on white by design (office laser printers), not brand colours.
    files: ['src/core/ui/print/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='form']:not(:has(JSXAttribute[name.name='method'][value.value='post']))",
          message: 'Every <form> needs method="post" so a submit before hydration never puts field values in the URL.',
        },
      ],
    },
  },
  {
    // Core must not reach into the sample domain's modules. The only permitted
    // seam is src/domain/contract.ts (and brand/), which every project defines.
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/domain/*', '!@/domain/contract', '@/app/*'],
              message:
                'Core may only depend on the domain through @/domain/contract. See FOUNDATION.md → Boundaries.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.{ts,mjs}', 'tests/**/*.ts', 'e2e/**/*.ts', 'prisma/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
