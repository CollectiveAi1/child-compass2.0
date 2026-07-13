module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#24313d', cloud: '#f7f9fb', sky: '#a9c8f5', pink: '#f6b4c6', mint: '#98d9cf', butter: '#f7d98b' },
      borderRadius: { blob: '34% 66% 58% 42% / 45% 45% 55% 55%' },
      boxShadow: { soft: '0 20px 50px -12px rgba(43,61,79,.14)' },
    },
  },
  plugins: [],
};
