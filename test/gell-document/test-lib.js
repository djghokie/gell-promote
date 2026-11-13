const assert = require('assert');

const { hash, verify, sameName } = require('../../gell-document/lib/signature');

describe('gell-document lib', function() {

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
