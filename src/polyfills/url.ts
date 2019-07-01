/* eslint-disable no-undef */
var getGlobal = function(): any {
    // the only reliable means to get the global object is
    // `Function('return this')()`
    // However, this causes CSP violations in Chrome apps.
    if (typeof self !== 'undefined') {
        return self;
    }
    if (typeof window !== 'undefined') {
        return window;
    }
    if (typeof global !== 'undefined') {
        return global;
    }
    throw new Error('unable to locate global object');
};

const URL =
    typeof getGlobal().URL !== 'undefined'
        ? getGlobal().URL
        : require('url').URL;
const URLSearchParams =
    typeof getGlobal().URLSearchParams !== 'undefined'
        ? getGlobal().URLSearchParams
        : require('url').URLSearchParams;

export { URL, URLSearchParams };
/* eslint-enable */
