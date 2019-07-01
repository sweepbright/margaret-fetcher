interface ErrorResponse {
    url: string;
    status: number;
    statusText: string;
    body: string | object;
}

class RequestError extends Error {
    readonly response: ErrorResponse;

    constructor(message: string, response: ErrorResponse) {
        super(message);
        this.response = response;
        Object.setPrototypeOf(this, RequestError.prototype);
    }
}

export { RequestError };
