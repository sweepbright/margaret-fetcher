/** eslint-disable */
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';

const isProd = process.env.NODE_ENV === 'production';

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/index.js',
        format: 'umd',
        name: 'MargaretFetcher',
    },
    plugins: [
        babel({
            exclude: 'node_modules/**',
        }),
        nodeResolve({
            jsnext: true,
            main: true,
            preferBuiltins: true,
        }),
        commonjs({
            // non-CommonJS modules will be ignored, but you can also
            // specifically include/exclude files
            include: 'node_modules/**',
        }),
        isProd && terser(),
    ].filter(Boolean),
};

/** eslint-enable */
