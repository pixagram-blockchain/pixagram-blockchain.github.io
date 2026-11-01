var webpack = require('webpack');
var path = require('path');
var TerserPlugin = require('terser-webpack-plugin');
var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
var HtmlWebpackPlugin = require("html-webpack-plugin");

// Modules every lazy page and dialog shares. Below splitChunks.minSize a
// shared group is not split out but copied into each async chunk that uses
// it: with minSize at 96 KB, MUI and the Buffer shim (buffer-lite) were
// copied into many chunks. These two groups split from 5 KB. With no floor
// at all, single-module chunks used up maxAsyncRequests and left more
// duplicated code elsewhere. Function tests on the resolved path avoid
// path-separator differences.
var NODE_SHIMS = /[\\/]node_modules[\\/](buffer-lite|buffer|process|events|util|assert|inherits|safe-buffer|readable-stream|string_decoder|stream-browserify|path-browserify|vm-browserify)[\\/]/;
function isMui(module) {
    return (module.resource || "").indexOf("@material-ui") !== -1;
}
function isNodeShim(module) {
    return NODE_SHIMS.test(module.resource || "");
}

// Plugins shared between development and production builds.
var commonPlugins = [
    // Rewrite `node:<builtin>` imports (e.g. `node:fs/promises`) to their bare
    // form so they hit resolve.fallback instead of throwing UnhandledSchemeError.
    // The `node:` scheme has no handler for target: 'web', and this runs in
    // beforeResolve so the prefix is gone before webpack tries to resolve it.
    new webpack.NormalModuleReplacementPlugin(/^node:/, function (resource) {
        resource.request = resource.request.replace(/^node:/, '');
    }),
    new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'], // Provide Buffer globally
        process: 'process/browser' // Automatically provide process
    }),
];

module.exports = {
    devtool: process.env.NODE_ENV === 'production' ? false: "nosources-source-map",
    entry: path.join(__dirname, "src/js/client.js"),
    mode: process.env.NODE_ENV,
    target: "web",
    experiments: {
        // syncWebAssembly removed: no rule uses the webassembly/sync type, and
        // every .wasm in the app goes through asyncWebAssembly.
        asyncWebAssembly: true,
        topLevelAwait: true,
    },
    optimization: process.env.NODE_ENV === 'production' ? {
        moduleIds: 'natural',
        realContentHash: true,
        minimize: true,
        minimizer: [
            new TerserPlugin({
                parallel: true,
                terserOptions: {
                    toplevel: true,
                    compress: {
                        passes: 4,
                        drop_console: true,
                        pure_funcs: ['console.log', 'console.info'],
                    },
                    mangle: {
                        toplevel: true,
                        eval: true,
                        reserved: [
                            'ArrayBuffer',
                            'Buffer',
                            'BigInteger',
                            'Point',
                            'ECPubKey',
                            'ECKey',
                            'sha512_asm',
                            'asm',
                            'ECPair',
                            'HDNode'
                        ]
                    },
                    output: {
                        comments: false,
                        beautify: false,
                    }
                }
            })
        ],
        chunkIds: 'natural',
        splitChunks: {
            chunks: 'async',
            minSize: 20000,
            maxSize: 480 * 1024,
            minChunks: 2,
            maxAsyncRequests: 30,
            maxInitialRequests: 30,
            automaticNameDelimiter: '_',
            name: false,
            cacheGroups: {
                mui: {
                    test: isMui,
                    minChunks: 2,
                    minSize: 5000,
                    priority: 0,
                    reuseExistingChunk: true,
                },
                nodeShims: {
                    test: isNodeShim,
                    minChunks: 2,
                    minSize: 5000,
                    priority: 0,
                    reuseExistingChunk: true,
                },
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    priority: -10
                },
                default: {
                    minChunks: 2,
                    maxAsyncRequests: 30,
                    maxInitialRequests: 30,
                    priority: -20,
                    reuseExistingChunk: true
                }
            }
        }
    }: {},
    module: {
        rules: [
            {
                test: /\.jsx?$/i,
                exclude: /[\\/]node_modules[\\/]/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,
                        // Targets come from "browserslist" in package.json: the
                        // browsers that can already parse the boot bundle (the
                        // webpack runtime and the dependencies in it ship
                        // optional chaining and BigInt literals untranspiled).
                        // Transpiling the app's own code for older browsers
                        // only added polyfills and an inlined regenerator
                        // runtime in over 100 modules. preset-env applies ?.
                        // and ?? itself when a target needs them, so the two
                        // proposal plugins are gone, and proposals: false
                        // stops core-js installing non-standard methods on
                        // built-in prototypes. The core-js version is read
                        // from the installed package, so the polyfills Babel
                        // references always exist.
                        //
                        // const/let are still compiled to var, as before. Some
                        // code reads a binding before its declaration has run
                        // (EditProfileDialog.js reads processFile in a
                        // dependency array above its useCallback). With var
                        // that reads undefined; with native const it throws a
                        // ReferenceError and takes the whole Profile page down.
                        presets: [
                            ['@babel/preset-env', {
                                useBuiltIns: "usage",
                                corejs: {version: require("core-js/package.json").version, proposals: false},
                                include: ["@babel/plugin-transform-block-scoping"],
                            }],
                            '@babel/preset-react', // For JSX and React
                        ],
                    },
                }
            }
        ]
    },
    output: {
        path: path.join(__dirname, 'client'),
        publicPath: "/client/",
        filename: "chunk_norris.min.js",
        chunkFilename: "chunk_[id].min.js",
        clean: true,
    },
    resolve: {
        extensions: ['.module.wasm', '.wasm', '.js', '.jsx', '.ts', '.tsx'],
        fallback: {
            "path": require.resolve('path-browserify'), // Polyfill for path
            "crypto": require.resolve('crypto-browserify'), // Polyfill for crypto
            "buffer": require.resolve('buffer'), // Polyfill for buffer
            "stream": require.resolve('stream-browserify'), // Polyfill for stream
            "vm": require.resolve("vm-browserify"),
            "assert": require.resolve('assert'), // Provide the polyfill
            "process": require.resolve('process/browser'), // Polyfill for process
            "zlib": false,
            "url": false,
            "https": false,
            "http": false,
            "fs": false,
            "fs/promises": false, // No browser filesystem; stub the promises submodule too
            "net": false, // Mock 'net'
            "tls": false  // Mock 'tls'
        },
        alias: {
            'bn.js': path.join(__dirname, 'node_modules/bn.js/lib/bn.js'),
            'process': path.join(__dirname, 'node_modules/process'),
            'readable-stream@4.1.0': path.join(__dirname, 'node_modules/readable-stream/lib/ours/browser.js'),
            "buffer": path.join(__dirname, 'node_modules/buffer-lite'),
            "react": "preact/compat",
            "react-dom/test-utils": "preact/test-utils",
            "react-dom": "preact/compat",
            "react/jsx-runtime": "preact/jsx-runtime"
        }
    },
    plugins: process.env.NODE_ENV === "development" ? [
        ...commonPlugins,
        new HtmlWebpackPlugin({
            template: "template.html",
            filename: "index.html",
            publicPath: "/client",
            inject: "body",
            cache: false,
        }),
        new BundleAnalyzerPlugin()
    ]: [
        ...commonPlugins,
        new HtmlWebpackPlugin({
            template: "./template.html",
            filename: "index.html",
            publicPath: "",
            inject: "body",
            minify: true,
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: "./template.html",
            filename: "404.html",
            publicPath: "",
            inject: "body",
            minify: true,
            cache: false,
        }),
        new BundleAnalyzerPlugin()
    ],
    devServer: {
        devMiddleware: {
            publicPath: "/client"
        },
        static: {
            directory: path.join(__dirname, "/"),
        },
        client: {
            reconnect: true,
        },
        hot: false,
        liveReload: false,
    },
    performance: {
        hints: process.env.NODE_ENV === "development" ? false: 'warning',
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
    },
};