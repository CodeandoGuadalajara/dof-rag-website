/** @type {import("prettier").Config} */
export default {
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
  // Opciones adicionales de Prettier que prefieras
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  printWidth: 80,
  trailingComma: 'es5',
}; 