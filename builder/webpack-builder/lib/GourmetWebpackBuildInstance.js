"use strict";

const util = require("util");
const npath = require("path");
const error = require("@gourmet/error");
const isPlainObject = require("@gourmet/is-plain-object");
const sortPlugins = require("@gourmet/plugin-sort");
const merge = require("@gourmet/merge");
const promiseWriteFile = require("@gourmet/promise-write-file");
const promiseProtect = require("@gourmet/promise-protect");
const omit = require("lodash.omit");
const webpack = require("webpack");
const recordsFile = require("./recordsFile");

const INVALID_PIPELINE = {
  message: "Pipeline '${pipeline}' is not defined or invalid",
  code: "INVALID_PIPELINE"
};

const CIRCULAR_PIPELINE = {
  message: "Pipeline '${pipeline}' has a circular reference",
  code: "CIRCULAR_PIPELINE"
};

const INVALID_ENTRY = {
  message: "'entry' must be an object containing at least one entry-point",
  code: "INVALID_ENTRY"
};

const INVALID_ENTRY_VALUE = {
  message: "Entry '${name}' has invalid value",
  code: "INVALID_ENTRY_VALUE"
};

const INVALID_ALIAS = {
  message: "'webpack.alias' must be an object",
  code: "INVALID_ALIAS"
};

const INVALID_DEFINE = {
  message: "'webpack.define' must be an object",
  code: "INVALID_DEFINE"
};

const INVALID_PLUGINS = {
  message: "'webpack.plugins' must be an array",
  code: "INVALID_PLUGINS"
};

const INVALID_WEBPACK_PLUGIN = {
  message: "Webpack plugin entry must be an object with '{name, [plugin]}' shape: ${item}",
  code: "INVALID_WEBPACK_PLUGIN"
};

const SERVER_ASSET_HASH_CHANGED = {
  message: "An asset's hash value has changed from the last client build. Asset path: ${path}",
  code: "SERVER_ASSET_HASH_CHANGED"
};

class GourmetWebpackBuildInstance {
  constructor() {
    this._globalAssets = [];
  }

  init(context) {
    return context.vars.getMulti("builder", "webpack", "entry").then(([builder, webpack, entry]) => {
      this._varsCache = {
        builder: builder || {},
        webpack: webpack || {},
        entry: entry || {}
      };
      this.outputDir = npath.resolve(context.workDir, this._varsCache.builder.outputDir || ".gourmet");
    }).then(() => {
      return this._prepareWebpackRecords(context);
    }).then(() => {
      return context.plugins.runAsync("build:webpack:init", context);
    });
  }

  finish(stats, context) {
    return promiseProtect(() => {
      if (stats.hasErrors() && !context.argv.ignoreCompileErrors)
        return {errorExit: true, stats};
      return this._finishWebpackRecords(context).then(() => {
        return this.writeManifest(stats, context).then(manifest => {
          return {errorExit: false, manifest, stats};
        });
      });
    });
  }

  getWebpackConfig(context) {
    return {
      context: this.getWebpackContext(context),
      target: this.getWebpackTarget(context),
      mode: this.getWebpackMode(context),
      devtool: this.getWebpackDevTool(context),
      optimization: this.getWebpackOptimization(context),
      entry: this.getWebpackEntry(context),
      resolve: this.getWebpackResolve(context),
      module: this.getWebpackModule(context),
      output: this.getWebpackOutput(context),
      plugins: this.getWebpackPlugins(context),
      recordsPath: this._recordsPath
    };
  }

  getWebpackContext(context) {
    return context.plugins.runWaterfallSync("build:webpack:context", context.workDir, context);
  }

  getWebpackTarget(context) {
    const target = context.target === "client" ? "web" : "node";
    return context.plugins.runWaterfallSync("build:webpack:target", target, context);
  }

  getWebpackMode(context) {
    const mode = context.minify ? "production" : "development";
    return context.plugins.runWaterfallSync("build:webpack:mode", mode, context);
  }

  getWebpackDevTool(context) {
    function _devtool() {
      if (context.target === "client") {
        if (context.stageIs("hot"))
          return context.sourceMap ? "cheap-eval-source-map" : "eval";
        else if (context.stageIs("local"))
          return context.sourceMap ? "eval-source-map" : false;
      }
      return context.sourceMap ? "source-map" : false;
    }

    return context.plugins.runWaterfallSync("build:webpack:devtool", _devtool(), context);
  }

  getWebpackOptimization(context) {
    const optimization = {
      minimize: context.minify,
      runtimeChunk: context.target === "client",
      splitChunks: (() => {
        if (context.target === "server" || context.stageIs("local"))
          return false;

        return {
          chunks: "all",
          minSize: 10000,
          maxInitialRequests: 20,
          maxAsyncRequests: 20
        };
      })()
    };
    return context.plugins.runWaterfallSync("build:webpack:optimization", optimization, context);
  }

  getWebpackEntry(context) {
    const entry = this._varsCache.entry;

    if (!isPlainObject(entry))
      throw error(INVALID_ENTRY);

    const names = Object.keys(entry);

    if (!names.length)
      throw error(INVALID_ENTRY);

    const res = {};

    names.forEach(name => {
      function _value(val) {
        if (typeof val === "string")
          return [val];
        else if (Array.isArray(val))
          return [].concat(val);
        throw error(INVALID_ENTRY_VALUE, {name});
      }

      const def = entry[name];
      let entryValue = _value(isPlainObject(def) ? def[context.target] : def);

      if (context.target === "client" && context.stageIs("hot"))
        entryValue.unshift("webpack-hot-middleware/client");

      entryValue = context.plugins.runWaterfallSync("build:webpack:entry", entryValue, name, def, context);

      res[name] = entryValue.length > 1 ? entryValue : entryValue[0];
    });

    return res;
  }

  getWebpackResolve(context) {
    const alias = this.getWebpackAlias(context);
    const resolve = {extensions: [".js"], alias};
    return context.plugins.runMergeSync("build:webpack:resolve", resolve, context);
  }

  getWebpackAlias(context) {
    let alias = this._varsCache.webpack.alias;
    if (alias !== undefined && !isPlainObject(alias))
      throw error(INVALID_ALIAS);
    alias = Object.assign({}, alias);
    return context.plugins.runMergeSync("build:webpack:alias", alias, context);
  }

  getWebpackModule(context) {
    const rules = this.getWebpackRules(context);
    const module = {rules};
    return context.plugins.runMergeSync("build:webpack:module", module, context);
  }

  getWebpackRules(context) {
    function _resolve(items) {
      function _sort() {
        return items.map((item, idx) => {
          return [item.order !== undefined ? item.order : 5000, idx, item];
        }).sort((a, b) => {
          const oa = a[0] * 10000 + a[1];
          const ob = b[0] * 10000 + b[1];
          return oa - ob;
        }).map(item => item[2]);
      }

      items = _sort();

      return items.map(item => {
        return Object.assign(omit(item, ["pipeline", "order"]), {
          use: _pipeline(item.pipeline)
        });
      });
    }

    function _pipeline(name, processed={}) {
      if (processed[name])
        throw error(CIRCULAR_PIPELINE, {pipeline: name});

      processed[name] = true;

      const pipeline = pipelines[name];

      if (!pipeline || !Array.isArray(pipeline) || !pipeline.length)
        throw error(INVALID_PIPELINE, {pipeline: name});

      return _loaders(pipeline, processed);
    }

    function _loaders(items, processed) {
      items = items.reduce((arr, item) => {
        if (typeof item === "object" && typeof item.pipeline === "string")
          arr = arr.concat(_pipeline(item.pipeline, processed));
        else
          arr.push(item);
        return arr;
      }, []);

      return sortPlugins(items, {
        normalize(item) {
          return Object.assign({}, item, {
            name: item.name || (typeof item.loader === "string" ? item.loader : undefined)
          });
        },
        finalize: item => {
          const loader = item.loader || item.name;
          const options = context.plugins.runWaterfallSync(`build:webpack:loader_options:${item.name}`, item.options, item.name, context);
          return options ? {loader, options} : loader;
        }
      });
    }

    const pipelines = context.plugins.runMergeSync("build:webpack:pipelines", {}, context);
    const defs = context.plugins.runMergeSync("build:webpack:loaders", {}, context);

    const keys = Object.keys(defs);

    const allExts = Object.keys(defs).reduce((exts, name) => {
      const def = defs[name];
      if (Array.isArray(def.extensions))
        return exts.concat(def.extensions);
      else
        return exts;
    }, []);

    return keys.map(key => {
      const def = defs[key];
      let resource = def.resource;

      if (!resource) {
        if (Array.isArray(def.extensions) && def.extensions.length) {
          resource = {
            test: this.getExtensionTester(def.extensions)
          };
        } else if (def.extensions === "*") {
          resource = {
            test: this.getTestNegator(this.getExtensionTester(allExts))
          };
        }
      }

      return {
        resource,
        issuer: def.issuer,
        oneOf: def.oneOf ? _resolve(def.oneOf) : undefined
      };
    });
  }

  getWebpackOutput(context) {
    const getter = this.getChunkFilenameGetter(context);
    const output = {
      filename: getter,
      chunkFilename: getter,
      path: npath.join(this.outputDir, context.stage, context.target),
      publicPath: context.staticPrefix,
      hashFunction: "sha1",
      hashDigestLength: 40
    };
    return context.plugins.runMergeSync("build:webpack:output", output, context);
  }

  getWebpackDefine(context) {
    const define = {
      "process.env.NODE_ENV": JSON.stringify(context.debug ? "development" : "production"),
      DEBUG: JSON.stringify(context.debug),
      SERVER: JSON.stringify(context.target === "server"),
      CLIENT: JSON.stringify(context.target === "client"),
      STAGE: JSON.stringify(context.stage)
    };
    const userDef = this._varsCache.webpack.define;

    if (userDef) {
      if (!isPlainObject(define))
        throw error(INVALID_DEFINE);
      merge(define, userDef);
    }

    return context.plugins.runMergeSync("build:webpack:define", define, context);
  }

  getWebpackPlugins(context) {
    const define = this.getWebpackDefine(context);
    let plugins = [];

    if (isPlainObject(define) && Object.keys(define).length > 1) {
      plugins.push({
        name: "webpack/define-plugin",
        plugin: webpack.DefinePlugin,
        options: define
      });
    }

    if (context.target === "client" && context.stageIs("hot")) {
      plugins.push({
        name: "webpack/hot-module-replacement-plugin",
        plugin: webpack.HotModuleReplacementPlugin
      });
    }

    const userPlugins = this._varsCache.webpack.plugins;

    if (userPlugins) {
      if (!Array.isArray(userPlugins))
        throw error(INVALID_PLUGINS);
      plugins = plugins.concat(userPlugins);
    }

    context.plugins.runMergeSync("build:webpack:plugins", {plugins}, context);

    return sortPlugins(plugins, {
      normalize(item) {
        if (!isPlainObject(item) || !item.name || typeof item.name !== "string")
          throw error(INVALID_WEBPACK_PLUGIN, {item});
        return item;
      },
      finalize(item) {
        let plugin = item.plugin;
        if (!plugin)
          plugin = require(item.name);
        if (typeof plugin === "function")
          plugin = new plugin(item.options);
        return plugin;
      }
    });
  }

  writeManifest(stats, context) {
    function _eps() {
      const eps = compilation.entrypoints;
      const res = {};
      if (eps) {
        eps.forEach((ep, name) => {
          res[name] = globalAssets.concat(ep.getFiles().filter(name => !name.endsWith(".map")));
        });
      }
      return res;
    }

    function _files() {
      return Object.keys(compilation.assets);
    }

    const globalAssets = context.target === "client" ? this._globalAssets : [];
    const compilation = stats.compilation;
    const obj = {};

    ["target", "stage", "debug", "minify", "sourceMap", "hashNames", "staticPrefix"].forEach(name => {
      obj[name] = context[name];
    });

    Object.assign(obj, {
      compilation: compilation.hash,
      entrypoints: _eps(),
      files: _files()
    });

    const path = npath.join(this.outputDir, context.stage, "server", `${context.target}_manifest.json`);
    const content = JSON.stringify(obj, null, context.minify ? 0 : 2);
    return promiseWriteFile(path, content, {useOriginalPath: true}).then(() => obj);
  }

  getExtensionTester(extensions) {
    const exts = extensions.reduce((exts, ext) => {
      exts[ext] = true;
      return exts;
    }, {});

    const tester = function(path) {
      const idx = path.indexOf("?");
      if (idx !== -1)
        path = path.substr(0, idx);
      const ext = npath.extname(path);
      return exts[ext];
    };

    tester[util.inspect.custom] = function() {
      return `extensionTester(${JSON.stringify(extensions)})`;
    };

    return tester;
  }

  getTestNegator(tester) {
    const negator = function(path) {
      return !tester(path);
    };

    negator[util.inspect.custom] = function(depth, options) {
      return "!" + util.inspect(tester, options);
    };

    return negator;
  }

  getChunkFilenameGetter(context) {
    return function({chunk}) {
      if (context.target === "server" || !context.hashNames)
        return `${chunk.name || chunk.id}_bundle.js`;
      else
        return context.records.chunks.getName(chunk.hash) + ".js";
    };
  }

  getAssetFilenameGetter(context, {ext, isGlobal}={}) {
    return function({content, path}) {
      let name = context.records.files.getName(content, {addNew: context.target === "client"});

      if (!name)
        throw error(SERVER_ASSET_HASH_CHANGED, {path});

      const extname = npath.extname(path);
      const basename = npath.basename(path, extname);

      if (!context.hashNames)
        name += "." + basename;

      name += (ext || extname);

      if (isGlobal)
        context.build.addGlobalAsset(name);

      return name;
    };
  }

  addGlobalAsset(filename) {
    if (this._globalAssets.indexOf(filename) === -1)
      this._globalAssets.push(filename);
  }

  _prepareWebpackRecords(context) {
    return recordsFile.prepare(
      this._getUserWebpackRecordsPath(context),
      this._recordsPath = this._getWebpackRecordsPath(context),
      context.argv.records
    );
  }

  _finishWebpackRecords(context) {
    return recordsFile.finish(
      this._getUserWebpackRecordsPath(context),
      this._getWebpackRecordsPath(context),
      context.argv.records
    );
  }

  _getUserWebpackRecordsPath(context) {
    const dir = npath.resolve(context.workDir, this._varsCache.webpack.recordsDir || ".webpack");
    return npath.join(dir, context.stage, `webpack.${context.target}.json`);
  }

  _getWebpackRecordsPath(context) {
    const dir = npath.join(this.outputDir, context.stage, "info");
    return npath.join(dir, `webpack.${context.target}.json`);
  }
}

module.exports = GourmetWebpackBuildInstance;
