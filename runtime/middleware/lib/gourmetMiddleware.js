"use strict";

const merge = require("@gourmet/merge");
const handleRequestError = require("@gourmet/handle-request-error");
const GourmetWatchMiddleware = require("@gourmet/watch-middleware");

module.exports = function factory(gourmet, baseOptions) {
  return {
    middleware(options) {
      gourmet.baseOptions = options = merge({
        staticMiddleware: false,  // "local", "proxy", "off" or falsy
        clientDir: null,          // when `staticMiddleware` is "local" (can be derived from `stage`, `workDir`, `outputDir`)
        staticPrefix: "/s/",      // when `staticMiddleware` is "local" or "proxy"
        serverUrl: null           // when `staticMiddleware` is "proxy"
      }, gourmet.baseOptions, baseOptions, options);

      const handlers = [];

      if (options.staticMiddleware === "local") {
        if (options.watch)
          handlers.push(require("./watch")(gourmet, options));
        handlers.push(require("./static")(gourmet, options));
      } else if (options.staticMiddleware === "proxy") {
        handlers.push(require("./proxy")(gourmet, options));
      }

      handlers.push(require("./serve")(gourmet, options));

      return (req, res, out) => {
        let idx = 0;

        function next(err) {
          if (err)
            return out(err);

          const handler = handlers[idx++];

          if (handler)
            handler(req, res, next);
          else
            out();
        }

        next();
      };
    },

    errorMiddleware(options) {
      const args = gourmet.baseOptions;

      options = merge({
        debug: args.debug
      }, options);

      if (args.staticMiddleware === "local" && args.watch) {
        const wopts = GourmetWatchMiddleware.options(args);
        options = merge(options, {
          head: [GourmetWatchMiddleware.client(wopts)]
        });
      }

      return (err, req, res, next) => {  // eslint-disable-line no-unused-vars
        handleRequestError(err, req, res, options);
      };
    }
  };
};
