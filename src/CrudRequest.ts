import JsonRequest from './JsonRequest';

export default class CrudRequest extends JsonRequest {
    /**
     * Name of the resource
     *
     * @type {string}
     */
    resource = 'users';

    /**
     * Display all items for this resource
     *
     * @returns {Promise}
     */
    index() {
        return this.get(this.resource);
    }

    /**
     * Store a new resource
     *
     * @param {Object} payload
     *
     * @returns {Promise}
     */
    store(payload: Body) {
        return this.post(this.resource, payload);
    }

    /**
     * Show a resource
     *
     * @param {Number} id
     *
     * @returns {Promise}
     */
    show(id: string) {
        return this.get(`${this.resource}/${id}`);
    }

    /**
     * Update a resource
     *
     * @param {Number} id
     * @param {Object} payload
     *
     * @returns {Promise}
     */
    update(id: string, payload: Body) {
        return this.put(`${this.resource}/${id}`, payload);
    }

    /**
     * Delete a resource
     *
     * @param {Number} id
     *
     * @returns {Promise}
     */
    destroy(id: string) {
        return this.delete(`${this.resource}/${id}`);
    }
}
