/**
 * {{field}} merge fields in plain text document bodies
 *  - no dependencies, so browser code can preview a template with the same rendering the server signs
 *  - field names are trimmed: {{ fullName }} and {{fullName}} are the same field
 *  - a field without a value is left as written, so a missing value shows instead of disappearing
 */
const MERGE_FIELD = /{{\s*([^}]*?)\s*}}/g;

function render(body, values={}) {
    return (body || '').replace(MERGE_FIELD, (match, field) => (values[field] !== undefined ? values[field] : match));
}

/**
 * The distinct merge fields a body uses, in order of first use
 */
function mergeFields(body) {
    return [...new Set([...(body || '').matchAll(MERGE_FIELD)].map(m => m[1]))];
}

/**
 * The merge fields a body uses that are not in fields ({ field: description })
 */
function unknownFields(body, fields={}) {
    return mergeFields(body).filter(field => !Object.prototype.hasOwnProperty.call(fields, field));
}

module.exports = {
    render,
    mergeFields,
    unknownFields,
}
