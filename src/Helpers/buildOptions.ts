import mapValues from 'lodash/mapValues';

export default function buildOptions(options: any) {
    return mapValues(options, value => {
        switch (typeof value) {
            case 'function':
                return value(options);

            case 'object':
                return buildOptions(value);

            default:
                return value;
        }
    });
}
