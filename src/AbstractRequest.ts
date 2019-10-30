import { parse, stringify } from 'qs';
import merge from 'lodash/merge';
import mergeWith from 'lodash/mergeWith';
import { URL } from './polyfills/url';
import { RequestError } from './errors';

require('isomorphic-fetch');

export type RequestOptions = {
    path: string;
    params: URLSearchParams;
    headers: HeadersInit;
    body?: Body;
    method: string;
};

type PromiseOrValue<T> = T | Promise<T>;

export interface Middleware<In = any, Out = any> {
    (res: In): PromiseOrValue<Out>;
}

export class AbstractRequest {
    middlewares: Middleware[] = [];
    memoizedResults = new Map<string, Promise<any>>();
    resource?: string;
    rootUrl?: string;

    // By default, we use the full request URL as the cache key.
    // You can override this to remove query parameters or compute a cache key in any way that makes sense.
    // For example, you could use this to take Vary header fields into account.
    // Although we do validate header fields and don't serve responses from cache when they don't match,
    // new reponses overwrite old ones with different vary header fields.
    protected cacheKeyFor(request: Request): string {
        return request.url;
    }

    // allow to force a cache clear
    clearCache() {
        this.memoizedResults.clear();
    }

    protected willSendRequest?(path: string): PromiseOrValue<void>;

    query: Record<string, any> = {};

    options: Partial<RequestInit> = {
        method: 'GET',
    };

    buildEndpoint(resource: string): URL {
        let rootURL = this.rootUrl;

        if (rootURL) {
            rootURL = rootURL.endsWith('/') ? rootURL : rootURL.concat('/');
        }

        let path = resource;
        if (path.startsWith('/')) {
            path = path.slice(1);
        }

        const pathWithQuery = this.addQueryToPath(path);

        const url = new URL(pathWithQuery, rootURL);

        return url;
    }

    addQueryToPath(path: string): string {
        let [basePath, queryParamsString] = extractQueryParamsString(path);
        // we need to use qs library here because the URLSearchParams class does not
        // supports the array syntax `?a[]=1&a[]=2`. And some servers does
        const queryParams = Object.assign(parse(queryParamsString), this.query);

        const search = stringify(queryParams);

        if (search) {
            return `${basePath}?${search}`;
        }

        return path;
    }

    private make<TResult = any>(
        path: string,
        options: RequestInit
    ): Promise<TResult> {
        let promise = this.fetch<TResult>(path, options);

        this.middlewares.forEach(middleware => {
            promise = promise.then(middleware);
        });

        return promise;
    }

    async fetch<TResult = any>(
        path: string,
        options: RequestInit
    ): Promise<TResult> {
        const url = this.buildEndpoint(path);

        merge(this.options, options);

        // this can modify the `this.options`
        if (this.willSendRequest) {
            // this could potentially change the options
            await this.willSendRequest(url.href);
            // merge the new possible mutated values for the options back in
            // this will mutate fetchOptions
        }

        // make sure headers are set
        if (
            !(this.options.headers && this.options.headers instanceof Headers)
        ) {
            this.options.headers = new Headers(
                this.options.headers || Object.create(null)
            );
        }

        // We accept arbitrary objects and arrays as body and serialize them as JSON
        if (
            this.options.body !== undefined &&
            this.options.body !== null &&
            (this.options.body.constructor === Object ||
                Array.isArray(this.options.body) ||
                ((this.options.body as any).toJSON &&
                    typeof (this.options.body as any).toJSON === 'function'))
        ) {
            this.options.body = JSON.stringify(this.options.body);
            // If Content-Type header has not been previously set, set to application/json
            if (!this.options.headers.get('Content-Type')) {
                this.options.headers.set('Content-Type', 'application/json');
            }
        }

        const request = new Request(String(url.href), this.options);
        const cacheKey = this.cacheKeyFor(request);

        const performRequest = async () => {
            try {
                const response: Response = await fetch(request);
                return await this.didReceiveResponse(response, request);
            } catch (error) {
                this.didEncounterError(error, request);
            }
        };

        if (request.method === 'GET') {
            let promise = this.memoizedResults.get(cacheKey);
            if (promise) return promise;

            promise = performRequest();
            this.memoizedResults.set(cacheKey, promise);
            return promise;
        } else {
            this.memoizedResults.delete(cacheKey);
            return performRequest();
        }
    }

    protected didEncounterError(error: Error, _request: Request) {
        throw error;
    }

    protected async didReceiveResponse<TResult = any>(
        response: Response,
        request: Request
    ): Promise<TResult> {
        if (response.ok) {
            return (parseBody(response) as any) as Promise<TResult>;
        } else {
            throw await errorFromResponse(response);
        }
    }

    setOptions(options: any) {
        this.options = options;

        return this;
    }

    withOptions(options: any) {
        this.options = mergeWith(
            this.options,
            options,
            (objValue, srcValue) => {
                if (objValue instanceof Headers) {
                    Object.keys(srcValue).forEach(header => {
                        objValue.set(header, srcValue[header]);
                    });
                    return objValue;
                }

                // let the method handler it
                return undefined;
            }
        );

        return this;
    }

    withBearerToken(token: string) {
        return this.withOptions({
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
    }

    setQueryParameters(parameters: Record<string, any>) {
        this.query = parameters;

        return this;
    }

    withQueryParameter(key: string, value: any) {
        this.query[key] = value;

        return this;
    }

    withQueryParameters(parameters: { [key: string]: any }) {
        this.query = merge({}, this.query, parameters);

        return this;
    }

    setMiddlewares(middlewares: Middleware[]) {
        this.middlewares = middlewares;

        return this;
    }

    withMiddleware(middleware: Middleware) {
        this.middlewares.push(middleware);

        return this;
    }

    withoutMiddlewares() {
        this.middlewares = [];

        return this;
    }

    protected get<TResult = any>(url: string) {
        return this.make<TResult>(url, {
            method: 'GET',
        });
    }

    protected put<TResult = any>(url: string, body?: Body, init?: RequestInit) {
        return this.make<TResult>(
            url,
            Object.assign(
                {
                    method: 'PUT',
                    body,
                },
                init
            )
        );
    }

    protected patch<TResult = any>(
        url: string,
        body?: Body,
        init?: RequestInit
    ) {
        return this.make<TResult>(
            url,
            Object.assign(
                {
                    method: 'PATCH',
                    body,
                },
                init
            )
        );
    }

    protected post<TResult = any>(
        url: string,
        body?: Body,
        init?: RequestInit
    ) {
        return this.make<TResult>(
            url,
            Object.assign(
                {
                    method: 'POST',
                    body,
                },
                init
            )
        );
    }

    protected delete<TResult = any>(url: string) {
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
                /^application\/vnd.sweepbright\.v[0-9]+\+json$/
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

    const body = ((await parseBody(response)) as any) as (string | object);

    return new RequestError(message, {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        body,
    });
}

function extractQueryParamsString(path: string): [string, string] {
    const queryPrefixIndex = path.indexOf('?');
    if (queryPrefixIndex >= 0) {
        return [
            path.slice(0, queryPrefixIndex - 1),
            path.slice(queryPrefixIndex),
        ];
    }

    return [path, ''];
}
