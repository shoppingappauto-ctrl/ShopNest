module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Resolve the shared monorepo package so Expo's Metro bundler and the
      // babel module resolver agree on the path. Metro also picks this up via
      // watchFolders in metro.config.js — both layers are belt-and-suspenders.
      [
        'module-resolver',
        {
          alias: {
            '@shopnest/shared': '../../packages/shared',
          },
        },
      ],
    ],
  }
}
