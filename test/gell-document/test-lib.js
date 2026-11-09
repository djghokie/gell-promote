const assert = require('assert');

const { render, mergeFields, unknownFields } = require('../../gell-document/lib/render');
const { hash, verify, sameName } = require('../../gell-document/lib/signature');

describe('gell-document lib', function() {

    describe('render', function() {
        it('fills in merge fields, with or without spaces', function() {
            assert.strictEqual(render('Hi {{name}}, {{ name }}!', { name: 'Dee' }), 'Hi Dee, Dee!');
        })

        it('leaves fields without a value as written', function() {
            assert.strictEqual(render('Hi {{name}} {{other}}', { name: 'Dee' }), 'Hi Dee {{other}}');
        })

        it('renders an empty body as empty text', function() {
            assert.strictEqual(render(undefined, {}), '');
        })
    })

    describe('mergeFields', function() {
        it('lists the distinct fields in order of first use', function() {
            assert.deepStrictEqual(mergeFields('{{b}} {{a}} {{ b }}'), ['b', 'a']);
        })

        it('reports fields that are not allowed', function() {
            assert.deepStrictEqual(unknownFields('{{a}} {{b}} {{toString}}', { a: 'A' }), ['b', 'toString']);
        })
    })

    describe('signature', function() {
        it('hashes the title and text with SHA-256', function() {
            assert.match(hash('Title', 'Text'), /^[0-9a-f]{64}$/);
            assert.notStrictEqual(hash('Title', 'Text'), hash('Title', 'Text.'));
        })

        it('verifies an unchanged document and rejects a changed one', function() {
            const signed$ = { title: 'Title', text: 'Text', signature: { hash: hash('Title', 'Text') } };

            assert.strictEqual(verify(signed$), true);
            assert.strictEqual(verify({ ...signed$, text: 'Changed' }), false);
        })

        it('matches names ignoring case and spacing', function() {
            assert.strictEqual(sameName('  dee   DRIVER ', 'Dee Driver'), true);
            assert.strictEqual(sameName('D Driver', 'Dee Driver'), false);
            assert.strictEqual(sameName('', ''), false);
        })
    })
})
