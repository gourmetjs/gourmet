---
id: tutorial-5
title: Finalizing the User Interface
---

## What we will add in this step

We will add the user interface for browsing news articles, backed by server APIs we added in the previous step. This will finalize the app for our tutorial. The next step will be all about deploying the final app in the production environment.

## Edited / added source files

### src/containers/NewsRoute.js

```js
import React, {Component} from "react";
import ArticlesPane from "./ArticlesPane";

export default class NewsRoute extends Component {
  static getInitialProps(gmctx) {
    return ArticlesPane.fetchInitialArticles("news", gmctx);
  }

  render() {
    return (
      <ArticlesPane source="news" {...this.props}/>
    );
  }
}
```

### src/containers/SavedRoute.js

```js
import React, {Component} from "react";
import ArticlesPane from "./ArticlesPane";

export default class SavedRoute extends Component {
  static getInitialProps(gmctx) {
    return ArticlesPane.fetchInitialArticles("saved", gmctx);
  }

  render() {
    return (
      <ArticlesPane source="saved" {...this.props}/>
    );
  }
}
```

### src/containers/ArticlesPane.js _(new)_

```js
import React, {Component} from "react";
import {css} from "emotion";
import httpApi from "../utils/httpApi";
import Articles from "../components/Articles";
import LoadButton from "../components/LoadButton";
import ErrorBanner from "../components/ErrorBanner";

const cssFooter = css`
  padding: 1em 0;
  text-align: center;
`;

const cssEmpty = css`
  color: #ccc;
  font-size: 300%;
  padding: 4em 1em;
`;

const cssError = css`
  position: fixed;
  width: 25em;
  left: 2em;
  top: 1em;
  z-index: 100;
`;

function Empty() {
  return (
    <div className={cssEmpty}>
      <i className="fas fa-exclamation-circle"/>
      &nbsp;
      This list is empty
    </div>
  );
}

export default class ArticlesPane extends Component {
  constructor(props) {
    super(props);
    this.state = {
      articles: props.articles,
      hasMore: props.hasMore,
      page: 1,
      lastError: null
    };
  }

  // source = "news" or "saved"
  static fetchInitialArticles(source, gmctx) {
    return httpApi(`/api/${source}`, {method: "GET"}, gmctx);
  }

  render() {
    const {articles, hasMore, lastError} = this.state;
    return (
      <>
        {lastError && (
          <ErrorBanner
            className={cssError}
            error={lastError}
            onClose={() => this.clearError()}
          />
        )}
        {articles && articles.length ? (
          <Articles
            articles={articles}
            saveArticle={article => this.saveArticle(article)}
            unsaveArticle={id => this.unsaveArticle(id)}
          />
        ) : (
          <Empty/>
        )}
        {hasMore ? (
          <div className={cssFooter}>
            <LoadButton label="Load more" onLoad={() => this.loadMore()}/>
          </div>
        ) : null}
      </>
    );
  }

  loadMore() {
    const {source} = this.props;
    const {page, articles} = this.state;

    return httpApi(`/api/${source}?page=${page + 1}`).then(data => {
      this.setState({
        articles: articles.concat(data.articles),
        hasMore: data.hasMore,
        page: page + 1
      });
    }).catch(err => {
      this.setState({lastError: err});
      throw err;
    });
  }

  saveArticle(article) {
    return httpApi("/api/saved", {
      method: "POST",
      body: {article}
    }).then(() => {
      const articles = this.state.articles.map(a => {
        if (a.id === article.id)
          return {...a, saved: true};
        else
          return a;
      });
      this.setState({articles});
    }).catch(err => {
      this.setState({lastError: err});
    });
  }
  
  unsaveArticle(articleId) {
    return httpApi(`/api/saved/${articleId}`, {method: "DELETE"}).then(() => {
      const {source} = this.props;
      let articles;
      if (source === "news") {
        articles = this.state.articles.map(a => {
          if (a.id === articleId)
            return {...a, saved: false};
          else
            return a;
        });
      } else {
        articles = this.state.articles.filter(a => {
          return a.id !== articleId;
        });
      }
      this.setState({articles});
    }).catch(err => {
      this.setState({lastError: err});
    });
  }

  clearError() {
    this.setState({lastError: null});
  }
}
```

### src/containers/MainPage.js

```js
import React from "react";
import i80, {ActiveRoute, Link} from "@gourmet/react-i80";
import httpApi from "../utils/httpApi";
import TabbedPanes from "../components/TabbedPanes";
import NewsRoute from "./NewsRoute";
import SavedRoute from "./SavedRoute";

i80([
  ["/", NewsRoute],
  ["/saved", SavedRoute]
]);

export default function MainPage({user}) {
  const tabs = [
    <Link className="nav-link" href="/" replace>
      <i className="far fa-newspaper"/>
      &nbsp;
      Latest News Headlines
    </Link>,
    <Link className="nav-link" href="/saved" replace>
      <i className="far fa-bookmark"/>
      &nbsp;
      Saved Articles
    </Link>
  ];

  return (
    <div className="container" style={{padding: "2em 0"}}>
      <div className="border-bottom mb-3 pb-2 text-right">
        Hello {user.name}!
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm ml-3"
          onClick={() => {
            httpApi("/api/logout", {
              method: "POST",
              body: {}
            }).then(() => {
              i80.goToUrl("/login");
            }).catch(err => {
              console.error(err);
            });
          }}
        >
          Log out
        </button>
      </div>
      <TabbedPanes tabs={tabs}>
        <ActiveRoute/>
      </TabbedPanes>
      <div className="text-muted mt-3">
        * News data from https://newsapi.org
      </div>
    </div>
  );
}
```

### src/components/TabbedPanes.js _(new)_

```js
import React from "react";

export default function TabbedPanes({tabs, children}) {
  return (
    <div className="card">
      <div className="card-header">
        <ul className="nav nav-tabs card-header-tabs">
          {tabs.map((content, idx) => (
            <li className="nav-item" key={idx}>
              {content}
            </li>
          ))}
        </ul>
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
}
```

### src/components/ErrorBanner.js _(new)_

```js
import React, {Component} from "react";
import cx from "classnames";

export default class ErrorBanner extends Component {
  componentDidMount() {
    this._timerId = setTimeout(() => {
      this.props.onClose();
      this._timerId = null;
    }, 15000);
  }

  componentWillUnmount() {
    if (this._timerId) {
      clearTimeout(this._timerId);
      this._timerId = 0;
    }
  }

  render() {
    const {className, error, onClose, ...props} = this.props;
    return (
      <div
        {...props}
        className={cx("alert alert-danger alert-dismissible", className)}
        onClick={onClose}
      >
        {error.toString()}
        <button type="button" className="close">
          <span>&times;</span>
        </button>
      </div>
    );
  }
}
```

### src/components/LoadButton.js _(new)_

```js
import React, {Component} from "react";
import cx from "classnames";
import {css} from "emotion";

const cssButton = css`
  min-width: 15em;
`;

export default class LoadButton extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      lastError: null
    };
  }

  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    return (
      <button
        type="button"
        className={cx(
          "btn btn-sm",
          {"btn-outline-primary": !this.state.lastError},
          {"btn-outline-danger": !!this.state.lastError},
          cssButton,
          this.props.className
        )}
        disabled={this.state.isLoading}
        onClick={() => this._onClick()}
        title={this.state.lastError ? this.state.lastError.message : ""}
      >
        {this.state.lastError ? (
          <span>
            <i className="fas fa-exclamation-triangle"/>
            &nbsp;
          </span>
        ) : null}
        {this.props.label}
        {this.state.isLoading ? (
          <span>
            ...
            &nbsp;
            <i className="fas fa-sync fa-spin"/>
          </span>
        ) : null}
      </button>
    );
  }

  _onClick() {
    if (!this.state.isLoading) {
      this.setState({isLoading: true, lastError: null});
      this.props.onLoad().then(() => {
        if (this._isMounted)
          this.setState({isLoading: false, lastError: null});
      }).catch(err => {
        if (this._isMounted)
          this.setState({isLoading: false, lastError: err});
      });
    }
  }
}
```

### src/components/Articles.js _(new)_

```js
import React from "react";
import Article from "./Article";

export default function Articles({articles, saveArticle, unsaveArticle}) {
  return (
    <div>
      {articles.map(article => (
        <Article
          article={article}
          saveArticle={saveArticle}
          unsaveArticle={unsaveArticle}
          key={article.id}
        />
      ))}
    </div>
  );
}
```

### src/components/Article.js _(new)_

```js
import React from "react";
import {css} from "emotion";
import BookmarkButton from "./BookmarkButton";

const cssArticle = css`
  position: relative;
  padding: 24px 16px;
  border-bottom: 1px solid #dee2e6;
`;

const cssImage = css`
  max-width: 256px;
  max-height: 256px;
`;

const cssSource = css`
  margin-top: 6px;
  font-size: 85%;
`;

const cssTitle = css`
  margin: 0 14px 10px 0;
`;

const cssBookmark = css`
  position: absolute;
  top: 24px;
  right: 0;
`;

export default function Article({article, saveArticle, unsaveArticle}) {
  const publishedAt = new Date(article.publishedAt).toLocaleString("en-US");
  return (
    <div className={"media " + cssArticle}>
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        <img className={`${cssImage} img-thumbnail mr-3`} src={article.image}/>
      </a>
      <div className="media-body">
        <h5 className={cssTitle}>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h5>
        {article.description}
        <div className={cssSource}>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {article.source} - {publishedAt}
          </a>
        </div>
      </div>
      <BookmarkButton
        className={cssBookmark}
        saved={article.saved}
        onClick={() => {
          if (article.saved)
            unsaveArticle(article.id);
          else
            saveArticle(article);
        }}
      />
    </div>
  );
}
```

### src/components/BookmarkButton.js _(new)_

```js
import React from "react";
import cx from "classnames";
import {css} from "emotion";

const cssBookmark = css`
  font-size: 24px;
  color: #ccc;
  cursor: pointer;
  &:hover {
    color: #888;
  }
`;

export default function BookmarkButton({saved, ...props}) {
  return (
    <div {...props}>
      <i className={cx(saved ? "fas" : "far", "fa-bookmark", cssBookmark)}/>
    </div>
  );
}
```

### src/utils/httpApi.js

```js
import selfUrl from "@gourmet/self-url";

export default function httpApi(url, options, gmctx) {
  options = {
    credentials: "same-origin",
    ...options,
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
      pragma: "no-cache",
      ...(options && options.headers)
    }
  };

  if (gmctx && gmctx.isServer) {
    // `/api/news` => `https://myserver.example.com/api/news`
    url = selfUrl(gmctx, url);

    // copy the "cookie" header from the original request
    options.headers.cookie = gmctx.reqArgs.headers.cookie;
  }

  if (options.body) {
    options.body = JSON.stringify(options.body);
    options.headers["content-type"] = "application/json";
  }

  return fetch(url, options).then(res => {
    return res.json().then(data =>{
      if (res.status !== 200) {
        const obj = data.error || {};
        const err = new Error(obj.message || res.statusText);
        err.code = obj.code;
        err.statusCode = obj.statusCode || res.status;
        err.detail = obj.detail;
        throw err;
      }
      return data;
    });
  });
}
```

### gourmet_config.js

```js
module.exports = {
  pages: {
    public: "./src/containers/PublicPage",
    main: "./src/containers/MainPage"
  },

  config: {
    html: {
      headTop: [
        '<link href="//stackpath.bootstrapcdn.com/bootstrap/4.1.0/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-9gVQ4dYFwwWSjIDZnLEWnxCjeSWFphJiwGPXr1jddIhOegiu1FwO5qRGvFXOdJZ4" crossorigin="anonymous">'
      ]
    },
    "html:main": {
      headTop: [
        '<link href="//use.fontawesome.com/releases/v5.0.12/css/all.css" rel="stylesheet" integrity="sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9" crossorigin="anonymous">'
      ]
    }
  }
};
```

### package.json

```json
{
  "private": true,
  "scripts": {
    "build": "gourmet build",
    "start": "node lib/server.js",
    "dev": "nodemon --ignore src lib/server.js -- --watch",
    "migrate": "knex migrate:latest",
    "migrate:rollback": "knex migrate:rollback"
  },
  "dependencies": {
    "express": "^4.16.4",
    "@gourmet/server-args": "^1.2.4",
    "@gourmet/client-lib": "^1.2.4",
    "body-parser": "^1.18.3",
    "@gourmet/error": "^0.3.4",
    "knex": "^0.16.3",
    "pg": "^7.9.0",
    "sqlite3": "^4.0.6",
    "express-session": "^1.15.6",
    "connect-session-knex": "^1.4.0",
    "bcrypt": "^3.0.5",
    "node-fetch": "^2.3.0"
  },
  "devDependencies": {
    "@gourmet/gourmet-cli": "^1.1.4",
    "@gourmet/preset-react": "^1.5.0",
    "@gourmet/group-react-i80": "^1.3.0",
    "@gourmet/group-react-emotion": "^1.1.4",
    "@gourmet/self-url": "^1.1.3",
    "core-js": "^3.0.0",
    "classnames": "^2.2.6",
    "react": "^16.8.5",
    "react-dom": "^16.8.5",
    "nodemon": "^1.18.10"
  }
}
```

## Fetching data for SSR

### Best practice

Because your SSR code for rendering the user interface can run on both sides of the target environment - server and browser, there are two cases in the data fetching.

1. When you render the initial content on the server-side, initiated by `res.serve()`.
2. When you update the DOM on the client side, usually initiated by the user's action such as clicking a button.

To make your life easier, it is best to make your data fetching code "isomorphic" as well. To support this, we recommend the following architecture as a best practice.

- Implement all your data access as APIs, and make them accessible equally from server and client.
- Inside your SSR code, fetch data by invoking the APIs.

Because your API signatures are the same regardless of where your code is running, your data fetching code becomes isomorphic. Now the only issue that we need to care about is the transport layer. Gourmet SSR provides the following two browser compatible methods inside the server-side VM sandbox.

- [`fetch`](https://fetch.spec.whatwg.org/) - You can use `fetch` as a global function just like you do in the browser. Under the hood, Gourmet SSR uses [`node-fetch`](https://github.com/bitinn/node-fetch) to simulate the browser API.
- [`XMLHttpRequest`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) - You can use `XMLHttpRequest` as a global object. We recommend `fetch`, but `XMLHttpRequest` is also provided for the case that you might need to use the legacy codebase. `XMLHttpRequest` in Gourmet SSR is based on [`node-XMLHttpRequest`](https://github.com/driverdan/node-XMLHttpRequest) with the local file access and the synchronous operation removed.

### `getInitialProps()`

In addition to the basic transport layer, Gourmet SSR also provides higher level assistance for the isomorphic data fetching.
When the rendering happens on the server-side, Gourmet SSR looks for a static function `getInitialProps()` in your page component. If it is defined, the static function gets called before the rendering begins. If it returns a promise, Gourmet SSR will wait for the promise to be resolved.

`getInitialProps()` is supposed to return an object, or a promise to be fulfilled with an object. The properties of the object will be handed over to the page component as React props.

The props returned by a page component's `getInitialProps()` will be serialized as a JSON object and transferred to the client. That is, a page component's `getInitialProps()` will be executed on the server-side only.

A route component also supports `getInitialProps()`. If defined, the result object is handed over to the route component as props, in addition to the page component's result of `getInitialProps()`, in case it is defined as well.

One subtlety of route component's `getInitialProps()` is that, because routes can be switched on the client side, it can be executed on the client as well. The initial content rendered on the server will contain a serialized result of the initial route component's `getInitialProps()`, so it will not be executed on the client side just like a page component. However, if a route switch occurs on the client, the newly activated route's `getInitialProps()` will be executed on the browser.

> The idea of the asynchronous data fetching via a static function of a component, named `getInitialProps()`, was made popular by [Next.js](https://nextjs.org/learn/basics/fetching-data-for-pages). We appreciate their work for the inspiration.

### Authentication

One important issue regarding the isomorphic data fetching is the authentication. Let's take a look at the flow of interaction between client and server in our news app.

1. A user logs in to our app. Now, a session cookie is saved in the user's browser.
2. The user visits `/` to get the HTML page containing the latest news articles.
3. The server receives the request and verifies the session cookie.
4. The server calls `res.serve("main")` to render the page.
5. Gourmet SSR calls the static `getInitialProps()` function of the route component `NewsRoute`.
6. The `getInitialProps()` function sends a HTTP GET request to the server API `/api/news` to fetch the latest news articles.
7. The server API `/api/news` verifies the session cookie, and sends back the news articles.
8. Gourmet SSR renders the initial content with the result of `getInitialProps()`.
9. The server-rendered HTML page is sent back to the browser.
10. The user clicks `Load more` button to fetch more articles.
11. The browser sends a HTTP GET request to the server API `/api/news` to fetch more articles.
12. The server API `/api/news` verifies the session cookie, and sends back the news articles.
13. The browser appends the fetched articles to the DOM.

Without special care, the request will fail at #7, because the request is generated on the server-side, via the isomorphic `fetch` method provided by Gourmet SSR. Unlike the browser, the server-side `fetch` can't attach the session cookie to the request automatically. It always generates clean, cookie-less requests by default. There are many possible solutions to this problem. A few examples are:

- Extract the session cookie from the original request at #3 and attach it to the API request at #6.
- Implement a token-based authentication method for APIs, and use tokens for server-side requests at #6. The server-side request tokens can be short-lived ones derived from the session data at #3, or from the client token if the client session is also using a token-based authentication method such as OAuth.
- Allow server-side API requests only from a predefined set of IP addresses.
- Use a global-super-power token for server-side API requests. You must keep this token secret.

We use method #1 for this tutorial. It is simple and as secure as the cookie-based authentication method itself, which has been widely used for many decades.

### Converting a relative path to an absolute path

In the browser, you can give a relative URL to `fetch` like `fetch("/api/news")`. The browser knows the base URL (where the HTML document came) and will send the request to the origin host correctly. However, on the server-side, `fetch` doesn't know where to send the request if you just give it a relative path. It requires an absolute URL that includes protocol and host.

Constructing the absolute URL from the request object in Node.js is possible, but surprisingly complicated when proxies are involved. `@gourmet/self-url` is a helper module that takes care of this conversion for you.

### Gourmet Context: `gmctx`

In order to handle all these tasks related to the data fetching in SSR code, we need the context information about the original request such as URL and HTTP headers. That is what `gmctx` is prepared for.

When you call `res.serve()` to render a HTML page using Gourmet SSR, a new context object with the information about the rendering request is created internally. By convention, we call the context object `gmctx`.

There are many ways to get `gmctx`. It is given to the page and route components as a prop. It is given to `getInitialProps()` as the only argument. It is also possible to get `gmctx` through [React Context](https://reactjs.org/docs/context.html) inside a rendering tree using `@gourmet/react-context-gmctx` module, which comes as a sub-package inside `@gourmet/preset-react`.

A few useful properties of `gmctx` are as follows:

| Property          | On server  | On client | Description            |
|-------------------|------------|-----------|------------------------|
| isServer          | true       | false     |                        |
| isClient          | false      | true      |                        |
| reqArgs.url       | /foo?a=1   | N/A       | path + query string    |
| reqArgs.method    | GET        | N/A       |                        |
| reqArgs.headers   | {...}      | N/A       | lower-cased            |

Let's take a look at how `gmctx` is used in real code.

```js
// src/utils/httpApi.js
import selfUrl from "@gourmet/self-url";
// ...
export default function httpApi(url, options, gmctx) {
  // ...
  if (gmctx && gmctx.isServer) {
    // `/api/news` => `https://myserver.example.com/api/news`
    url = selfUrl(gmctx, url);

    // copy the "cookie" header from the original request
    options.headers.cookie = gmctx.reqArgs.headers.cookie;
  }
  // ...
}
```

`httpApi()` receives the `gmctx` object as the last optional argument, newly added in this step, and uses it to do two additional things that are needed only on server-side.

1. It converts a relative URL to an absolute URL, using `@gourmet/self-url` module. The request information in `gmctx.reqArgs` is used inside.
2. It copies cookies from the original client request to the new `fetch` request to preserve the authenticated session.

> **What about Apollo?**
>
> We are working on the [Apollo](https://www.apollographql.com/) support package as another choice of data fetching method in Gourmet SSR. Stay tuned!

## Emotion Support in Gourmet SSR

We use [`Emotion`](https://5bb1495273f2cf57a2cf39cc--emotion.netlify.com/) for styling components in this step. Gourmet SSR provides seamless integration with Emotion, including the auto-enabling of `babel-plugin-emotion`, and the stream-based server rendering via `renderStylesToNodeStream()`.

As we explained in [Adding Real UI and Styling](/docs/tutorial-2) step, we recommend a pattern that uses a CSS framework such as Bootstrap as a base stylesheet globally, and do the additional, per-component customization using the inline style or Emotion.

The choice between the inline style and Emotion are largely based on your preference, but there might be some performance implications based on usage. If a component is instantiated many times in the same page, using Emotion will probably result in better performance because instances of the component will have the same `className` prop, and the browser can reuse the same set of CSS declarations for all instances. On the other hand, inline styles must be processed individually per each instance.

To use Emotion in your Gourmet SSR project, you must add the package `@gourmet/group-react-emotion` as a dependency. Once you do this, you can import `emotion` and `react-emotion` inside your SSR code without adding them individually. Gourmet Builder will resolve them to the corresponding sub-packages inside `@gourmet/group-react-emotion`.

> Currently, Gourmet SSR supports Emotion v9. We are aware of the release of v10.
> It appears that v10 is a drastic departure from the previous version with many breaking changes in the user-facing API.
> We haven't spent enough time evaluating the benefits and/or drawbacks of the new changes yet.
> Stay tuned!

## Using Font Awesome

We used [Font Awesome](https://fontawesome.com/) for rendering icons in this step.

```js
// gourmet_config.js
module.exports = {
  // ...
  config: {
    // ...
    "html:main": {
      headTop: [
        '<link href="//use.fontawesome.com/releases/v5.0.12/css/all.css" rel="stylesheet" integrity="sha384-G0fIWCsCzJIMAVNQPfjH08cyYaUtMwjJwqiRKxxE/rx96Uroj1BtIQ6MLJuheaO9" crossorigin="anonymous">'
      ]
    }
  }
};
```

Because we used the icons in the main page only, we appended a specifier `:main` to the `html` section name to make this configuration setting applied only to the `main` page. By doing this, links to both Bootstrap and Font Awesome CSS will be inserted to `main` page, but only a Bootstrap CSS link will be inserted to `public` page.

## React I80's `Link` component

We used `Link` component from `@gourmet/react-i80` to render anchor tags instead of the plain `<a>` in `MainPage` as below.

```js
// src/containers/MainPage.js
// ...
const tabs = [
  <Link className="nav-link" href="/" replace>
    <i className="far fa-newspaper"/>
    &nbsp;
    Latest News Headlines
  </Link>,
  <Link className="nav-link" href="/saved" replace>
    <i className="far fa-bookmark"/>
    &nbsp;
    Saved Articles
  </Link>
];
```

`Link` supports additional features such as adding `active` to `className` if the currently active route matches with the target URL `href`, and replacing (instead of pushing) the top element of navigation history when visited, if the boolean prop `replace` is true. 

## How components work together

### `ArticlesPane`

`ArticlesPane` is a container component that does all the heavy lifting, providing most glue logic through event handlers (`loadMore`, `saveArticle`, and `unsaveArticle`), between a route component (`NewsRoute` or `SavedRoute`) as a parent, and presentational components (`Articles`, `ErrorBanner`, and `LoadButton`) as children.

A static function `fetchInitialArticles()` is used as a helper to implement the parent route component's `onInitialProps()` static function. It fetches the initial data using `httpApi()` function. It is important to hand over `gmctx` to `httpApi()` here, because this function can be called on both server and client. On the other hand, other event handlers that call `httpApi()` omit `gmctx`, because they are always executed in the browser.

### `TabbedPanes`

This component implements the tabbed panes using Bootstrap's [card with nav](https://getbootstrap.com/docs/4.0/components/card/#navigation). `MainPage` uses this to provide the tabbed UI.

### `ErrorBanner`

This is a component that renders an auto-disappearing error banner, used by `ArticlesPane` when `httpApi()` fails.

### `LoadButton`

This is the `Load more` button at the end of news articles. It expects `onLoad()` handler to return a promise, and enters into the pending state until the promise is resolved.

## Running and testing

In this step, we added the following new packages to `devDependencies`.

- `@gourmet/group-react-emotion`: A group of sub-packages to support React Emotion in Gourmet SSR.
- `@gourmet/self-url`: A relative to absolute URL converter.
- `classnames`: A helper function(`cx`) to manipulate `className` prop.

Run the following to test.

```text
npm install
NEWS_API_KEY=0123456789abcdef0123456789abcdef npm run dev
```

For Windows, run the following instead.

```text
set NEWS_API_KEY=0123456789abcdef0123456789abcdef
npm install
npm run dev
```

Don't forget to replace the example hex string with your own News API key.

Now that you have completed the user interface and back-end API, you should be able to use all of the features that we laid out at the beginning of this tutorial. Congratulations!
