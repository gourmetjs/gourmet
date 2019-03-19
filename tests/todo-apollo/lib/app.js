"use strict";

const express = require("express");
const morgan = require("morgan");
const serverArgs = require("@gourmet/server-args");
const gourmet = require("@gourmet/client-lib");
const con = require("@gourmet/console")();
const {ApolloServer} = require("apollo-server-express");
const schema = require("./schema");
const TodoData = require("./TodoData");
const resolvers = require("./resolvers");

module.exports = function(def) {
  const args = serverArgs(Object.assign({
    workDir: __dirname + "/..",
    outputDir: "../../.gourmet/todo-apollo"
  }, def));
  const app = express();

  const apollo = new ApolloServer({
    typeDefs: schema,
    dataSources() {
      return {todoData: new TodoData()};
    },
    resolvers
  });

  app.use(morgan("dev"));

  app.use((req, res, next) => {
    if (req.url === "/custom-graphql" && req.headers["x-gourmet-test-name"] !== "@gourmet/test-todo-apollo")
      next(Error("x-gourmet-test-name header error"));
    else
      next();
  });

  apollo.applyMiddleware({app, path: "/custom-graphql"});

  app.use(gourmet.middleware(args));

  app.get("/", (req, res) => {
    res.serve("main");
  });

  app.use(gourmet.errorMiddleware());

  app.server = app.listen(args.port, () => {
    con.log(`Server is listening on port ${args.port}...`);
    con.info(`GraphQL path is ${apollo.graphqlPath}`);
  });

  return app;
};
