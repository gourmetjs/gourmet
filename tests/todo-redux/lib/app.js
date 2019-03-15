"use strict";

const express = require("express");
const morgan = require("morgan");
const serverArgs = require("@gourmet/server-args");
const gourmet = require("@gourmet/client-lib");
const con = require("@gourmet/console")();

module.exports = function(def) {
  const args = serverArgs(Object.assign({
    workDir: __dirname + "/..",
    outputDir: "../../.gourmet/todo-redux"
  }, def));
  const app = express();

  app.use(morgan("dev"));
  app.use(gourmet.middleware(args));

  app.get("/", (req, res) => {
    res.serve("main");
  });

  app.use(gourmet.errorMiddleware());

  app.server = app.listen(args.port, () => {
    con.log(`Server is listening on port ${args.port}...`);
  });

  return app;
};
