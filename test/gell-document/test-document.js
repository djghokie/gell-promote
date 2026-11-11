const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const MockStore = require('../../gell-aws-dynamodb/mock/store');
const discover = require('../../gell-discover/node');
const { Types } = require('../../gell-discover/domain/types');
const browser = require('../../gell-web/domain/browser');

const document = require('../../gell-document/domain/document');
const documentSnapshot = require('../../gell-document/snapshot/document');

const NAMESPACE = 'UNITTEST';

describe('gell-document', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        const types = new Types();
        types.register(document.TYPE, document.model, 'TENANT');

        const store = new MockStore('type', 'id');

        this.deps.define('types', types);
        this.deps.define('store', store);
        this.deps.alias('store', 'sessionStore');
        this.store = store;

        const { __events: events } = discover([`${__dirname}/../../gell-document`]);
        Object.keys(events).forEach(name => this.events[name] = events[name]);

        this.operator_ = browser.materialize({ userId: 'operator@example.com' });
    })

    function saveDocument(params) {
        return this.dispatch({
            route: 'document.save#action',
            caller: this.operator_,
            params,
            deps: this.deps
        });
    }

    function documents(namespace=NAMESPACE) {
        return this.store.select({ type: `${namespace}::${document.TYPE}` });
    }

    // NOTE: DOCUMENTs are scoped to the TENANT; in the admin app the buses set this per event from the session
    beforeEach(function() {
        this.deps.resolveSingle('types').set('namespace', NAMESPACE, 'TENANT');
    })

    describe('document.save', function() {
        it('creates DOCUMENT with the given id, namespaced by the TENANT', async function() {
            await saveDocument.call(this, { id: 'markdown', format: 'MARKDOWN', content: '# Hello' });

            const [document$] = documents.call(this);

            assert.strictEqual(document$.id, 'markdown');
            assert.strictEqual(document$.content, '# Hello');
            assert(document$.updatedTs);
        })

        it('replaces content of existing DOCUMENT', async function() {
            await saveDocument.call(this, { id: 'markdown', format: 'MARKDOWN', content: '# One', title: 'Notes' });
            await saveDocument.call(this, { id: 'markdown', format: 'MARKDOWN', content: '# Two' });

            const documents$ = documents.call(this);

            assert.strictEqual(documents$.length, 1);
            assert.strictEqual(documents$[0].content, '# Two');
            assert.strictEqual(documents$[0].title, 'Notes');
        })

        it('keeps the same id apart in another TENANT', async function() {
            await saveDocument.call(this, { id: 'markdown', format: 'MARKDOWN', content: '# Mine' });

            this.deps.resolveSingle('types').set('namespace', 'OTHER', 'TENANT');
            await saveDocument.call(this, { id: 'markdown', format: 'MARKDOWN', content: '# Theirs' });

            assert.strictEqual(documents.call(this)[0].content, '# Mine');
            assert.strictEqual(documents.call(this, 'OTHER')[0].content, '# Theirs');
        })

        it('accepts empty content', async function() {
            await saveDocument.call(this, { id: 'richtext', format: 'HTML', content: '' });

            const [document$] = documents.call(this);

            assert.strictEqual(document$.content, '');
        })

        it('rejects unknown format', async function() {
            await assert.rejects(saveDocument.call(this, { id: 'x', format: 'PDF', content: '' }), /format must be one of/);
        })
    })

    describe('document', function() {
        it('returns DOCUMENT by id', async function() {
            await saveDocument.call(this, { id: 'richtext', format: 'HTML', content: '<p>hi</p>' });

            const document$ = await documentSnapshot.api({ params: { id: 'richtext' }, deps: this.deps });

            assert.strictEqual(document$.content, '<p>hi</p>');
        })

        it('returns unsaved DOCUMENT placeholder', async function() {
            const document$ = await documentSnapshot.api({ params: { id: 'never-saved' }, deps: this.deps });

            assert.strictEqual(document$.id, 'never-saved');
            assert.strictEqual(document$.content, undefined);
            assert.strictEqual(document$.updatedTs, undefined);
        })
    })
})
