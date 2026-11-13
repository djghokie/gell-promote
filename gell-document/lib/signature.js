const crypto = require('crypto');

/**
 * Typed-name signatures
 *  - hash: SHA-256 (hex) of exactly what was signed - the title, a blank line, then the text
 *  - verify: whether a signed document's text still matches its signature hash
 *  - sameName: compares a typed signature with the signer's name, ignoring case and extra spaces
 *
 * WIP: a typed name through a private link is the only signature evidence; IP address, device or a
 *      one-time code are open questions for the legal review (sc-513)
 */
function hash(title, text) {
    return crypto.createHash('sha256').update(`${title}\n\n${text}`).digest('hex');
}

function verify(signed$) {
    return !!(signed$ && signed$.signature && signed$.signature.hash === hash(signed$.title, signed$.text));
}

function normalizeName(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function sameName(name1, name2) {
    return normalizeName(name1) !== '' && normalizeName(name1) === normalizeName(name2);
}

module.exports = {
    hash,
    verify,
    normalizeName,
    sameName,
}
