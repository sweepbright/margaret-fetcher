import 'isomorphic-fetch';
import {parse as parseUrl} from 'url';
import merge from 'lodash/merge';
import {buildQuery, buildOptions} from './Helpers';

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
     * @type {string}
     */
    rootUrl = '/api';

    /**
     * @param {String} pathname
     *
     * @return {String}
     */
    buildEndpoint(pathname) {
        const {protocol, host} = parseUrl(this.rootUrl);
        const query = this.query;

        const built = buildQuery({protocol, host, pathname, query});
        if (!host) {
            return `${this.rootUrl}/${built}`;
        }

        return built;
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

        return this.fetch(url, body);
    }

    /**
     * Make a raw fetch request
     *
     * @param {String} url
     * @param {Object} body
     *
     * @returns {Promise}
     */
    fetch(url, body = {}) {
        const endpoint = this.buildEndpoint(url);
        let promise = fetch(endpoint, body);

        this.middlewares.forEach(middleware => {
            promise = promise.then(middleware);
        });

        return promise;
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
                    return `Bearer ${typeof token === 'function' ? token(options) : token}`;
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

    withMiddleware(middleware) {
        this.middlewares.push(middleware);

        return this;
    }

    withoutMiddlewares() {
        this.middlewares = [];

        return this;
    }

    //////////////////////////////////////////////////////////////////////
    ////////////////////////////// REQUESTS //////////////////////////////
    //////////////////////////////////////////////////////////////////////

    get(url) {
        return this.make(url, {method: 'GET'});
    }

    put(url, body) {
        return this.make(url, {method: 'PUT', body});
    }

    patch(url, body) {
        return this.make(url, {method: 'PATCH', body});
    }

    post(url, body) {
        return this.make(url, {method: 'POST', body});
    }

    delete(url) {
        return this.make(url, {method: 'DELETE'});
    }
}
