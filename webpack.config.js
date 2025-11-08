var webpack = require('webpack');
var path = require('path');
var TerserPlugin = require('terser-webpack-plugin');
var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
var HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    devtool: process.env.NODE_ENV === 'production' ? false: "nosources-source-map",
    entry: path.join(__dirname, "src/js/client.js"),
    mode: process.env.NODE_ENV,
    target: "web",
    experiments: {
        asyncWebAssembly: true,
        syncWebAssembly: true,
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
                    compress: {
                        passes: 4,
                        drop_console: true,
                        pure_funcs: ['console.log', 'console.info'],
                    },
                }
            })
        ],
        chunkIds: 'natural',
        splitChunks: {
            chunks: 'async',
            minSize: 96 * 1024,
            maxSize: 480 * 1024,
            minChunks: 2,
            maxAsyncRequests: 30,
            maxInitialRequests: 30,
            automaticNameDelimiter: '_',
            name: false,
            cacheGroups: {
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
                test: /\.(js||jsx)$/i,
                exclude: /[\\/]node_modules[\\/]/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,
                        presets: [
                            ['@babel/preset-env', {
                                useBuiltIns: "usage",
                                shippedProposals: true,
                                corejs: {version: "3.8", proposals: true}
                            }],
                            '@babel/preset-react', // For JSX and React
                        ],
                        plugins: [
                            '@babel/plugin-proposal-nullish-coalescing-operator', // Optional chaining
                            '@babel/plugin-proposal-optional-chaining',
                        ]
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
            "net": false, // Mock 'net'
            "tls": false  // Mock 'tls'
        },
        alias: {
            'bn.js': path.join(__dirname, 'node_modules/bn.js/lib/bn.js'),
            'process': path.join(__dirname, 'node_modules/process'),
            'readable-stream': path.join(__dirname, 'node_modules/readable-stream'),
            'readable-stream@4.1.0': path.join(__dirname, 'node_modules/readable-stream/lib/ours/browser.js'),
            "react": "preact/compat",
            "react@16.8.0": "preact/compat",
            "react@17.0.0": "preact/compat",
            "react-dom/test-utils": "preact/test-utils",
            "react-dom": "preact/compat",
            "react/jsx-runtime": "preact/jsx-runtime",
            "buffer": "buffer-lite",
            "core-js@1.2.7": "core-js"
        }
    },
    plugins: process.env.NODE_ENV === "development" ? [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'], // Provide Buffer globally
            process: 'process/browser' // Automatically provide process
        }),
        new HtmlWebpackPlugin({
            template: "template.html",
            filename: "index.html",
            publicPath: "/client/",
            inject: "body",
            cache: false,
        }),
        new BundleAnalyzerPlugin()
    ]: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'], // Provide Buffer globally
            process: 'process/browser' // Automatically provide process
        }),
        new HtmlWebpackPlugin({
            template: "./template.html",
            filename: "index.html",
            publicPath: "client/",
            inject: "body",
            minify: true,
            cache: false,
        }),
        new HtmlWebpackPlugin({
            template: "./template.html",
            filename: "404.html",
            publicPath: "client/",
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
