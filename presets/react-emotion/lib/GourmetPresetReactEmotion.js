"use strict";

// This preset is designed to replace `@gourmet/preset-react`, instead of being
// supplemental to avoid peer dependency warnings from React, Webpack & Babel
// plugins.
//
// 8/17/2018 Added `prop-types` to prevent the following warning from yarn:
//   "@gourmet/preset-react-emotion > react-emotion > create-emotion-styled@9.2.6" has unmet peer dependency "prop-types@15.x".
class PresetReactEmotion {
  onAlias(context) {
    const moduleDir = context.builder.moduleDir(__dirname);
    return {
      "@gourmet/react-context-gmctx": moduleDir("@gourmet/react-context-gmctx"),
      "@gourmet/react-loadable": moduleDir("@gourmet/react-loadable"),
      "react-hot-loader": moduleDir("react-hot-loader"),
      "emotion": moduleDir("emotion"),
      "react-emotion": moduleDir("react-emotion"),
      "@gourmet/emotion-renderer": moduleDir("@gourmet/emotion-renderer"),
      "@gourmet/watch-middleware": moduleDir("@gourmet/watch-middleware")
    };
  }
}

PresetReactEmotion.meta = {
  subplugins: [
    "@gourmet/plugin-webpack-builder",
    "@gourmet/plugin-webpack-babel",
    "@gourmet/plugin-webpack-global-css",
    "@gourmet/plugin-webpack-blob",
    "@gourmet/plugin-webpack-dev-server",
    "@gourmet/plugin-react",
    "@gourmet/plugin-react-hot-loader",
    "@gourmet/plugin-react-loadable",
    "@gourmet/plugin-react-emotion"
  ],
  hooks: {
    "build:webpack:alias": PresetReactEmotion.prototype.onAlias
  }
};

module.exports = PresetReactEmotion;
