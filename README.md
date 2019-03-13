<h1 align="center">
  <a href="https://ssr.gourmetjs.org">
    <img src="/docs/assets/logo_w_tagline.png" alt="Gourmet SSR">
  </a>
</h1>

## Introduction

- **Library, not Framework** - Gourmet SSR is designed to be used as a view library in your existing project. We worked very hard to make Gourmet SSR unobtrusive.
- **Production First** - Small footprint at runtime, chunked transfer, long-term caching, HTTP/2 optimized bundling and much more. Production is always the number one priority of Gourmet SSR.
- **Human Friendly** - Developers are humans too. When we a new feature, the first thing we consider is how to make it easy to understand and use - just like we do for the consumer products.
- **Flexible** - Gourmet SSR can be deployed as an in-process VM sandbox, a separate process, a remote HTTP cluster or an AWS Lambda function. Your server can be Django or Rails. The view layer is not limited to React.

## Quick Overview

> You write the user interface without complicated bootstrapping or boilerplate. It is just a plain tree of React components.

```js
// hello.js
import React from "react";

export default function Hello({greeting}) {
  return <div>{greeting}</div>;
}
```
<br>

> Configuration is designed to be minimal, but not to the level of "magic". Here, we specify the above React component as a root component of the `main` page.

```js
// gourmet_config.js
module.exports = {
  pages: {
    main: "./hello.js"
  }
};
```
<br>

> Gourmet SSR is just a view library in your server. This is how you render and serve the `main` page.

```js
// server.js
const express = require("express");
const gourmet = require("@gourmet/client-lib");

const app = express();

app.use(gourmet.middleware());

app.get("/", (req, res) => {
  res.serve("main", {greeting: "Hello, world!"});
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
```
<br>

> The content is rendered on the server-side and rehydrated on the client-side.
> Required assets are also linked statically.
>
> The HTML output has all the elements it needs to render the initial user interface - which is great for SEO and user experience.

```html
$ curl http://localhost:3000
<!doctype html>
<html lang="en">
  <head>
    <script defer src="/s/vendors~main.js"></script>
    <script defer src="/s/main.js"></script>
  </head>
  <body>
    <div id="__gourmet_content__"><div id="__gourmet_react__"><div>Hello, world!</div></div></div>
    <script>window.__gourmet_data__={"renderedLoadables":[],"clientProps":{"greeting":"Hello, world!"},"reactClientRender":"hydrate"};</script>
  </body>
</html>
```

## Documentation

Learn more about using [Gourmet SSR on the official website](https://ssr.gourmetjs.org).

- [Getting Started](https://ssr.gourmetjs.org/docs/getting-started)
- [Tutorial](https://ssr.gourmetjs.org/docs/tutorial-1)

## License

Gourmet SSR is open source software [licensed as MIT](https://github.com/gourmetjs/gourmet-ssr/blob/master/LICENSE).
