// @ts-check
import merge from 'lodash/merge';
import { URL } from './polyfills/url';
import { buildOptions } from './Helpers';
import { RequestError } from './errors';

require('isomorphic-fetch');

export type Body = BodyInit | object;

type RequestOptions = {
    path: string;
    params: URLSearchParams;
    headers: HeadersInit;
    body?: Body;
    method: string;
};

export default class AbstractRequest {
    middlewares = [];

    resource?: string;
    rootUrl?: string;
    willSendRequest?: (options: RequestOptions) => Promise<void>;

    query = {};

    options: Partial<RequestInit> = {
        method: 'GET',
    };

    subrequests = {};

    buildEndpoint(resource: string): URL {
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

    make<TResult = any>(
        path: string,
        options: RequestInit = {}
    ): Promise<TResult> {
        let body = merge(this.options, options);
        body = buildOptions(body);

        let promise = this.fetch<TResult>(path, body);

        this.middlewares.forEach(middleware => {
            promise = promise.then(middleware);
        });

        return promise;
    }

    async fetch<TResult = any>(
        path: string,
        fetchOptions: RequestInit
    ): Promise<TResult> {
        const url = this.buildEndpoint(path);

        const options = {
            path: url.pathname,
            params: url.searchParams,
            headers: fetchOptions.headers || {},
            ...(fetchOptions.body && {
                body: fetchOptions.body.toString(),
            }),
            method: fetchOptions.method || 'GET',
        };

        if (this.willSendRequest) {
            await this.willSendRequest(options);
        }

        const response = await fetch(url.href, fetchOptions);
        return this.didReceiveResponse<TResult>(response);
    }

    protected async didReceiveResponse<TResult = any>(
        response: Response
    ): Promise<TResult> {
        if (response.ok) {
            return (parseBody(response) as any) as Promise<TResult>;
        } else {
            throw await errorFromResponse(response);
        }
    }

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

    setOptions(options) {
        this.options = options;

        return this;
    }

    withOptions(options) {
        this.options = merge(this.options, options);

        return this;
    }

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

    setQueryParameters(parameters) {
        this.query = parameters;

        return this;
    }

    withQueryParameter(key: string, value: any) {
        this.query[key] = value;

        return this;
    }

    withQueryParameters(parameters: [{ [key: string]: any }]) {
        this.query = merge(this.query, parameters);

        return this;
    }

    setMiddlewares(middlewares) {
        this.middlewares = middlewares;

        return this;
    }

    withMiddleware(middleware) {
        this.middlewares.push(middleware);

        return this;
    }

    withoutMiddlewares() {
        this.middlewares = [];

        return this;
    }

    get<TResult = any>(url: string) {
        return this.make<TResult>(url, { method: 'GET' });
    }

    put<TResult = any>(url: string, body: BodyInit) {
        return this.make<TResult>(url, {
            method: 'PUT',
            body,
        });
    }

    patch<TResult = any>(url: string, body: BodyInit) {
        return this.make<TResult>(url, {
            method: 'PATCH',
            body,
        });
    }

    post<TResult = any>(url: string, body: BodyInit) {
        return this.make<TResult>(url, {
            method: 'POST',
            body,
        });
    }

    delete<TResult = any>(url: string) {
        return this.make<TResult>(url, {
            method: 'DELETE',
        });
    }
}

function parseBody(response: Response): Promise<object | string> {
    const contentType = response.headers.get('Content-Type');
    const contentLength = response.headers.get('Content-Length');
    try {
        if (
            // As one might expect, a "204 No Content" is empty! This means there
            // isn't enough to `JSON.parse`, and trying will result in an error.
            response.status !== 204 &&
            contentLength !== '0' &&
            contentType &&
            // this line is Sweepbright specific, which is not cool
            // FIXME: make this generic
            (contentType.match(
                /^application\/vnd.sweepbright\.v[0-9]{8}\+json$/
            ) ||
                contentType.startsWith('application/json'))
        ) {
            return response.json();
        } else {
            return response.text();
        }
    } catch (err) {
        return Promise.resolve('');
    }
}

async function errorFromResponse(response: Response) {
    const message = `${response.status}: ${response.statusText}`;

    const body = await parseBody(response);

    return new RequestError(message, {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        body,
    });
}
