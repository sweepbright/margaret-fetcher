export declare class Body {
    readonly bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    json(): Promise<any>;
    text(): Promise<string>;
}

export declare class Request extends Body {
    constructor(input: Request | string, init?: RequestInit);

    readonly method: string;
    readonly url: string;
    readonly headers: Headers;

    clone(): Request;
}

export interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit;
    mode?: RequestMode;
    credentials?: RequestCredentials;
    cache?: RequestCache;
    redirect?: RequestRedirect;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    integrity?: string;

    // The following properties are node-fetch extensions
    follow?: number;
    timeout?: number;
    compress?: boolean;
    size?: number;
    agent?: RequestAgent | false;

    // Cloudflare Workers accept a `cf` property to control Cloudflare features
    // See https://developers.cloudflare.com/workers/reference/cloudflare-features/
    cf?: {
        [key: string]: any;
    };
}
