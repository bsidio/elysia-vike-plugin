import { Elysia } from "elysia";
import { elysiaConnectDecorate } from "elysia-connect";
import { ViteConfig, getViteConfig } from "elysia-vite";
import * as path from "path";
import { renderPage } from "vike/server";
import { ssr, UserConfig as ConfigVikeUserProvided } from "vike/plugin";
import type { Connect, ViteDevServer } from "vite";
import { ServerResponse } from "node:http";

export type ElysiaVikeConfig = ViteConfig & {
    pluginVike?: ConfigVikeUserProvided;
    onPluginVikeReady?(viteServer: ViteDevServer): void;
};

const log: (...args: any[]) => void = !!process.env?.DEBUG
    ? console.log.bind(console, "[elysia-vike]")
    : () => {};

export const elysiaVike =
    (config?: ElysiaVikeConfig) => async (app: Elysia) => {
        const _app = app.use(elysiaConnectDecorate());
        const { pluginVike, onPluginVikeReady, ...resolvedConfig } =
            (await getViteConfig(config)) || {};
        if (!pluginVike) return _app;
        log("resolvedConfig", resolvedConfig);

        const vite = await import("vite");

        const viteServer: ViteDevServer = await vite.createServer({
            root: resolvedConfig?.root || path.resolve(process.cwd(), "./"),
            ...resolvedConfig,
            server: { middlewareMode: true, ...resolvedConfig?.server },
            plugins: (resolvedConfig?.plugins || []).concat([
                ssr({
                    baseServer: resolvedConfig?.base,
                    ...pluginVike,
                }),
            ]),
        });

        const viteDevMiddleware = viteServer.middlewares;
        log("viteDevMiddleware", !!viteDevMiddleware);

        if (onPluginVikeReady) {
            await onPluginVikeReady?.(viteServer);
        }

        return _app
            .on("stop", async () => {
                log("onStop :: reached");
                return await viteServer.close();
            })
            .group(config?.base || "", (app) =>
                app
                    .onBeforeHandle(async (context) => {
                        log("onBeforeHandle :: reached", context.request.url);
                        const handled = await context.elysiaConnect(
                            viteDevMiddleware,
                            context
                        );
                        log("onBeforeHandle :: handle?", !!handled);
                        if (handled) return handled;
                    })
                    .get("*", async (context) => {
                        const handled = await context.elysiaConnect(
                            createVikeConnectMiddleware(
                                viteServer,
                                resolvedConfig
                            ),
                            context
                        );
                        if (handled) return handled;
                    })
            );
    };

function createVikeConnectMiddleware(
    viteServer: ViteDevServer,
    resolvedConfig: ViteConfig
): Connect.NextHandleFunction {
    return async (req, res, next) => {
        const pageContextInit = {
            urlOriginal: req.originalUrl || req.url || '/',
        };
        const pageContext = await renderPage(pageContextInit);
        const { httpResponse } = pageContext;
        if (!httpResponse) return next();
        const { body, statusCode, contentType, earlyHints } = httpResponse;
        if (res.writeEarlyHints)
            res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) });
        res.statusCode = statusCode;
        res.setHeader('Content-Type', contentType);
        res.end(body);
    };
}
