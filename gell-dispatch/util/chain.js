function build(...m) {
    if (m.length === 0) return z => {};

    const first = m.shift();

    return z => first(z, build(...m));
}

module.exports = build;