"use strict";

class PluginReactEmotion {
  onPipelines(context) {
    return {
      js: [{
        virtual: true,
        name: "babel-loader",
        options: {
          plugins: [{
            name: "babel-plugin-emotion",
            plugin: require.resolve("babel-plugin-emotion"),
            options: {
              hoist: context.stageIs("production"),
              sourceMap: context.config.builder.sourceMap,
              autoLabel: context.debug
            }
          }]
        }
      }]
    };
  }

  onPageRenderer({target}) {
    if (target === "server") {
      return [
        "@gourmet/emotion-renderer/server"
      ];
    }
  }
}

PluginReactEmotion.meta = {
  schema: {
    after: "@gourmet/plugin-react"
  },
  hooks: {
    "build:webpack_pipelines": PluginReactEmotion.prototype.onPipelines,
    "build:page_renderer": PluginReactEmotion.prototype.onPageRenderer
  }
};

module.exports = PluginReactEmotion;
