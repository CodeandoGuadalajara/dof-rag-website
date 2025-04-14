module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:astro/recommended',
  ],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  overrides: [
    {
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
      rules: {
        // Aquí puedes añadir o sobrescribir reglas específicas para Astro
      },
    },
    {
      // Asegúrate de que los archivos de configuración usen CommonJS si son .cjs
      files: ['*.cjs'],
      env: {
        node: true,
        commonjs: true,
      },
    }
    // Puedes añadir más overrides para otros tipos de archivos (e.g., *.ts)
  ],
  rules: {
    // Aquí puedes añadir o sobrescribir reglas globales de ESLint
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_+', varsIgnorePattern: '^_+' },
    ],
  },
}; 