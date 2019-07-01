// @ts-check
import merge from 'lodash/merge';
import { URL } from './polyfills/url';
import { buildOptions } from './Helpers';

require('isomorphic-fetch');

export default class AbstractRequest {
    /**
     * @type {Array}
     */
    middlewares = [];

    /**
     * The default query parameters
     *
     * @type {Object}
     */
    query = {};

    /**
     * The default options
     *
     * @type {Object}
     */
    options = {
        method: 'GET',
    };

    /**
     * Subrequests to alias under this one
     *
     * @type {Object}
     */
    subrequests = {};

    /**
     * @param {String} resource
     *
     * @return {URL}
     */
    buildEndpoint(resource) {
        let rootURL = this.rootUrl;

        if (rootURL) {
            rootURL = rootURL.endsWith('/') ? rootURL : rootURL.concat('/');
        }

        let path = resource;
        if (path.startsWith('/')) {
            path = path.slice(1);
        }

        const url = new URL(path, rootURL);
        // add query params
        Object.keys(this.query).forEach(queryParam => {
            const queryValue = this.query[queryParam];
            if (Array.isArray(queryValue)) {
                // add array query
                queryValue.forEach(arrayItemValue => {
                    url.searchParams.append(`${queryParam}`, arrayItemValue);
                });
            } else {
                url.searchParams.append(queryParam, queryValue);
            }
        });

        return url;
    }

    /**
     * Make a request somewhere
     *
     * @param {String} url
     * @param {Object} options
     *
     * @returns {Promise}
     */
    make(url, options = {}) {
        let body = merge(this.options, options);
        body = buildOptions(body);

        let promise = this.fetch(url, body);
        this.middlewares.forEach(middleware => {
            promise = promise.then(middleware);
        });

        return promise;
    }

    /**
     * Make a raw fetch request
     *
     * @param {String} path
     * @param {Object} body
     *
     * @returns {Promise}
     */
    async fetch(path, fetchOptions = {}) {
        const url = this.buildEndpoint(path);

        const options = {
            path: url.pathname,
            params: url.searchParams,
            headers: fetchOptions.headers || {},
            ...(fetchOptions.body && { body: fetchOptions.body.toString() }),
            method: fetchOptions.method || 'GET',
        };

        if (this.willSendRequest) {
            await this.willSendRequest(options);
        }

        return fetch(url.href, fetchOptions);
    }

    //////////////////////////////////////////////////////////////////////
    ///////////////////////////// SUBREQUESTS ////////////////////////////
    //////////////////////////////////////////////////////////////////////

    getSubrequest(subrequest, id) {
        if (typeof subrequest === 'string') {
            if (this.subrequests.hasOwnProperty(subrequest)) {
                subrequest = this.subrequests[subrequest];
            } else {
                throw new Error(`No subrequest named ${subrequest} defined`);
            }
        }

        subrequest.resource = `${this.resource}/${id}/${subrequest.resource}`;

        return subrequest;
    }

    //////////////////////////////////////////////////////////////////////
    ////////////////////////////// OPTIONS ///////////////////////////////
    //////////////////////////////////////////////////////////////////////

    /**
     * Set the default options for all requests
     *
     * @param {Object} options
     *
     * @return {AbstractRequest}
     */
    setOptions(options) {
        this.options = options;

        return this;
    }

    /**
     * Merge some options to the defaults
     *
     * @param {Object} options
     *
     * @return {AbstractRequest}
     */
    withOptions(options) {
        this.options = merge(this.options, options);

        return this;
    }

    /**
     * @param {String} token
     *
     * @return {AbstractRequest}
     */
    withBearerToken(token) {
        return this.withOptions({
            headers: {
                Authorization: options => {
                    return `Bearer ${
                        typeof token === 'function' ? token(options) : token
                    }`;
                },
            },
        });
    }

    //////////////////////////////////////////////////////////////////////
    ////////////////////////// QUERY PARAMETERS //////////////////////////
    //////////////////////////////////////////////////////////////////////

    /**
     * @param {Object} parameters
     *
     * @return {AbstractRequest}
     */
    setQueryParameters(parameters) {
        this.query = parameters;

        return this;
    }

    /**
     * @param {String} key
     * @param {String} value
     *
     * @return {AbstractRequest}
     */
    withQueryParameter(key, value) {
        this.query[key] = value;

        return this;
    }

    /**
     * @param {Object} parameters
     *
     * @return {AbstractRequest}
     */
    withQueryParameters(parameters) {
        this.query = merge(this.query, parameters);

        return this;
    }

    //////////////////////////////////////////////////////////////////////
    ///////////////////////////// MIDDLEWARES ////////////////////////////
    //////////////////////////////////////////////////////////////////////

    /**
     * @param {Function[]} middlewares
     *
     * @returns {AbstractRequest}
     */
    setMiddlewares(middlewares) {
        this.middlewares = middlewares;

        return this;
    }

    /**
     * @param {Function} middleware
     *
     * @returns {AbstractRequest}
     */
    withMiddleware(middleware) {
        this.middlewares.push(middleware);

        return this;
    }

    /**
     * @returns {AbstractRequest}
     */
    withoutMiddlewares() {
        this.middlewares = [];

        return this;
    }

    //////////////////////////////////////////////////////////////////////
    ////////////////////////////// REQUESTS //////////////////////////////
    //////////////////////////////////////////////////////////////////////

    get(url) {
        return this.make(url, { method: 'GET' });
    }

    put(url, body) {
        return this.make(url, { method: 'PUT', body });
    }

    patch(url, body) {
        return this.make(url, { method: 'PATCH', body });
    }

    post(url, body) {
        return this.make(url, { method: 'POST', body });
    }

    delete(url) {
        return this.make(url, { method: 'DELETE' });
    }
}
