/**
 * Business-rule errors: 400 (ParameterValidationError) by default, 403 (ForbiddenError)
 */
function invalid(message, status=400) {
    const e = new Error(message);
    e.name = status === 403 ? 'ForbiddenError' : 'ParameterValidationError';
    e.status = status;

    return e;
}

module.exports = {
    invalid,
}
