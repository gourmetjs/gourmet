"use strict";

const npath = require("path");
const fs = require("fs");
const shell = require("pshell");
const promiseEach = require("@gourmet/promise-each");
const promiseMain = require("@gourmet/promise-main");
const puppeteerEnv = require("./puppeteerEnv");

const NPM_CLIENT = process.env.USE_YARN ? "yarn" : "npm";
const TARGET_DIR = npath.join(__dirname, "../../../.gourmet-standalone/tests");

function main() {
  return promiseEach(fs.readdirSync(TARGET_DIR), async name => {
    const desDir = npath.join(TARGET_DIR, name);

    const pkg = require(npath.join(desDir, "package.json"));

    if (!pkg.scripts || !pkg.scripts.test)
      return;

    console.log(`Running test on '${desDir}'`);

    await shell(`${NPM_CLIENT} test`, {
      echoCommand: false,
      cwd: desDir,
      env: puppeteerEnv
    });
  });
}

promiseMain(main());
