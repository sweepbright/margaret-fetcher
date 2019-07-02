export default (responseBody: any) => {
    if (responseBody != null && typeof responseBody === 'object') {
        return responseBody.data;
    }

    return responseBody;
};
