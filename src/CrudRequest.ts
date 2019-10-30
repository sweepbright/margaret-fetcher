import JsonRequest from './JsonRequest';

export default class CrudRequest extends JsonRequest {
    resource!: string;

    index<TResult = any>() {
        return this.get<TResult>(this.resource);
    }

    store(payload: Body) {
        return this.post(this.resource, payload);
    }

    show<TResult = any>(id: string) {
        return this.get<TResult>(`${this.resource}/${id}`);
    }

    update<TResult = any>(id: string, payload: Body) {
        return this.put<TResult>(`${this.resource}/${id}`, payload);
    }

    destroy<TResult = any>(id: string) {
        return this.delete<TResult>(`${this.resource}/${id}`);
    }
}
