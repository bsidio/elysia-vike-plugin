WIP
```js
// src/index.ts
import {Elysia} from 'elysia';
import {elysiaVitePluginSsr} from 'elysia-vike-plugin';

const app = new Elysia()
    .use(elysiaVitePluginSsr({
        pluginSsr: { // <-- must exist to trigger vite-plugin-ssr
            // ... vite-plugin-ssr options
            // baseAssets: 'https://cdn.example.com/assets/'
        },
        // onPluginSsrReady() {
        //   console.log("vite middleware is ready")   
        // },
        // ... optional other vite config
        base: "/ssr", // no trailing slash
        root: path.resolve(import.meta.dir, "./"), // directories `./pages`, `./renderer` should exists
    }));
```
