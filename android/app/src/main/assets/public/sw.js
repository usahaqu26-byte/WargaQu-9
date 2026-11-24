/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "wargaqu-share.jpg",
    "revision": "217235eef8b45adc0603865973e8016d"
  }, {
    "url": "store.html",
    "revision": "ffa3697570ffeb1a5e5701f5dad874f8"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "efc84a5d7b1e7ecda758aac45ce67738"
  }, {
    "url": "pwa-512x512.png",
    "revision": "651ea245a86c6c50005db74ec9428d68"
  }, {
    "url": "pwa-192x192.png",
    "revision": "3649812790a8dbd835813340e87aac07"
  }, {
    "url": "index.html",
    "revision": "6c4cc95473046bf8de006e64b68d00e1"
  }, {
    "url": "icon.svg",
    "revision": "f8c11ed66fb69e7c38afb09669dc2436"
  }, {
    "url": "favicon.ico",
    "revision": "9372f9290b6206d72cc73543904981be"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "1ed7c035a56a06a72115e9e49706c837"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/web-DKxMuMoY.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-hePW80VL.js",
    "revision": null
  }, {
    "url": "assets/purify.es-B7SQ8EAD.js",
    "revision": null
  }, {
    "url": "assets/jspdf.es.min-BrYUYYwz.js",
    "revision": null
  }, {
    "url": "assets/index.es-DAZu1jDW.js",
    "revision": null
  }, {
    "url": "assets/index-W6jXRFBE.css",
    "revision": null
  }, {
    "url": "assets/index-BoENSdo2.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-Dn6bw578.js",
    "revision": null
  }, {
    "url": "assets/firebase-CA98DPK0.js",
    "revision": null
  }, {
    "url": "assets/esm-93kugKI6.js",
    "revision": null
  }, {
    "url": "assets/es-Ct67x-Wl.js",
    "revision": null
  }, {
    "url": "pwa-192x192.png",
    "revision": "3649812790a8dbd835813340e87aac07"
  }, {
    "url": "pwa-512x512.png",
    "revision": "651ea245a86c6c50005db74ec9428d68"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "efc84a5d7b1e7ecda758aac45ce67738"
  }, {
    "url": "manifest.webmanifest",
    "revision": "e3e89f7505f1fda683bf82d0fa6771cc"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/ws-relay/, /store\.html/, /manifest\.webmanifest$/]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i, new workbox.CacheFirst({
    "cacheName": "osm-tiles-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
