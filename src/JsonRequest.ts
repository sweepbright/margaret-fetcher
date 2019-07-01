import { AbstractRequest } from './AbstractRequest';

export default class JsonRequest extends AbstractRequest {
    constructor() {
        super();

        this.withOptions({
            type: 'json',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
    }
}
