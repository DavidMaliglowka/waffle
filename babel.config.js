module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    // 👇 Keep this plugin last in the list
    plugins: ['react-native-reanimated/plugin'],
  };
}; 