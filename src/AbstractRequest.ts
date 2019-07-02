import merge from 'lodash/merge';
import * as qs from 'qs';
import { URL } from './polyfills/url';
import { RequestError } from './errors';

require('isomorphic-fetch');

export type Body = BodyInit | object;

export type Request = RequestInit & {
    body?: Body;
};

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

    resource?: string;
    rootUrl?: string;

    protected willSendRequest?(request: RequestOptions): PromiseOrValue<void>;

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
        const queryParams = Object.assign(
            qs.parse(queryParamsString),
            this.query
        );

        const search = qs.stringify(queryParams);

        if (search) {
            return `${basePath}?${search}`;
        }

        return path;
    }

    private make<TResult = any>(
        path: string,
        options: RequestInit
    ): Promise<TResult> {
        const init: RequestInit = Object.assign(this.options, options);

        let promise = this.fetch<TResult>(path, init);

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

        // make sure headers are set
        if (
            !(fetchOptions.headers && fetchOptions.headers instanceof Headers)
        ) {
            fetchOptions.headers = new Headers(
                fetchOptions.headers || Object.create(null)
            );
        }

        const options = {
            path: url.href,
            params: url.searchParams,
            headers: fetchOptions.headers,
            ...(fetchOptions.body && {
                body: fetchOptions.body.toString(),
            }),
            method: fetchOptions.method || 'GET',
        };

        if (this.willSendRequest) {
            // this could potentially change the options
            await this.willSendRequest(options);
        }

        // We accept arbitrary objects and arrays as body and serialize them as JSON
        if (
            fetchOptions.body !== undefined &&
            fetchOptions.body !== null &&
            (fetchOptions.body.constructor === Object ||
                Array.isArray(fetchOptions.body) ||
                ((fetchOptions.body as any).toJSON &&
                    typeof (fetchOptions.body as any).toJSON === 'function'))
        ) {
            fetchOptions.body = JSON.stringify(fetchOptions.body);
            // If Content-Type header has not been previously set, set to application/json
            if (!fetchOptions.headers.get('Content-Type')) {
                fetchOptions.headers.set('Content-Type', 'application/json');
            }
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

    setOptions(options: any) {
        this.options = options;

        return this;
    }

    withOptions(options: any) {
        this.options = merge(this.options, options);

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

    withQueryParameters(parameters: [{ [key: string]: any }]) {
        this.query = merge(this.query, parameters);

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
