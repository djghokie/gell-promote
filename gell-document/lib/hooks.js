/**
 * The application's effect for a document event, from the optional `documentHooks` dependency:
 * { [name]: { signed, signerSigned } } (effect modules)
 *  - signed: the document is signed by everyone (../event/complete)
 *  - signerSigned: the signer signed and the cosigners have yet to (../event/webhook)
 *
 * NOTE: an explicit dependency, not the gell registry - discovery only registers modules with an action or api
 */
module.exports = function hook(name, event, deps) {
    let hooks;
    try {
        hooks = deps.resolveSingle('documentHooks');
    } catch (e) {
        return undefined;
    }

    return (hooks || {})[name] && hooks[name][event];
}
