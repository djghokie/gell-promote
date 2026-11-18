const assert = require('assert');

const { marshall } = require('@aws-sdk/util-dynamodb');

const schema = require('../../gell-search/schema');
const document = require('../../gell-search/document');
const memory = require('../../gell-search/engine/memory');
const typesense = require('../../gell-search/engine/typesense');
const index = require('../../gell-search/indexer');
const reindex = require('../../gell-search/reindex');

const base = {
    name: 'TEST#BASE',
    attributes: {
        nickname: { type: 'string', searchable: true },
    }
}

const person = {
    name: 'TEST#PERSON',
    extends: [base],
    attributes: {
        type: { type: 'string', default: 'TEST#PERSON', searchable: { project: true } },
        firstName: { type: 'string', searchable: { index: true, weight: 2, project: true } },
        lastName: { type: 'string', searchable: { index: true, weight: 3, project: true } },
        email: { type: 'email', searchable: { index: true, project: true } },
        phone: { type: 'phone', searchable: { index: true, project: true } },
        status: { type: 'string', searchable: { filter: true } },
        notes: 'text',
    }
}

const ADA = { id: 'p1', type: 'TEST#PERSON', firstName: 'Ada', lastName: 'Lovelace', email: 'Ada.Lovelace@Example.com', phone: '(406) 555-1234', status: 'ACTIVE', notes: 'secret' };
const GRACE = { id: 'p2', type: 'TEST#PERSON', firstName: 'Grace', lastName: 'Hopper', email: 'grace@navy.mil', phone: '406-555-9876', status: 'INACTIVE' };

function streamRecord(eventName, item$) {
    const image = marshall(item$, { removeUndefinedValues: true });

    return { eventName, dynamodb: eventName === 'REMOVE' ? { OldImage: image } : { NewImage: image } };
}

describe('gell-search', function() {

    describe('schema', function() {
        it('derives fields from searchable attributes, including inherited ones', function() {
            const fields = schema.fields(person);

            assert.deepStrictEqual(fields.map(f => f.name), ['nickname', 'type', 'firstName', 'lastName', 'email', 'phone', 'status']);
            assert.strictEqual(fields.find(f => f.name === 'nickname').index, 'text');
            assert.strictEqual(fields.find(f => f.name === 'email').index, 'email');
            assert.strictEqual(fields.find(f => f.name === 'phone').index, 'phone');
            assert.strictEqual(fields.find(f => f.name === 'lastName').weight, 3);
            assert.strictEqual(fields.find(f => f.name === 'status').filter, true);
            assert.strictEqual(fields.find(f => f.name === 'type').index, undefined);
        })

        it('is searchable only with an indexed attribute', function() {
            assert.strictEqual(schema.searchable(person), true);
            assert.strictEqual(schema.searchable({ name: 'X', attributes: { a: 'string' } }), false);
        })

        it('names collections by namespace and type', function() {
            assert.strictEqual(schema.collection(person, 'app.test'), 'app_test__test_person');
            assert.strictEqual(schema.collection(person), 'test_person');
        })
    })

    describe('document', function() {
        it('normalizes indexed values and projects raw values', function() {
            const doc = document(person, ADA);

            assert.strictEqual(doc.id, 'p1');
            assert.strictEqual(doc.label, 'Ada Lovelace');
            assert.strictEqual(doc.email, 'ada.lovelace@example.com');
            assert.strictEqual(doc.phone, '4065551234');
            assert.strictEqual(doc.phone_last4, '1234');
            assert.strictEqual(doc.status, 'ACTIVE');
            assert.strictEqual(doc.notes, undefined);
            assert.deepStrictEqual(JSON.parse(doc.projected), {
                type: 'TEST#PERSON', firstName: 'Ada', lastName: 'Lovelace', email: 'Ada.Lovelace@Example.com', phone: '(406) 555-1234'
            });
        })

        it('uses the model label function', function() {
            const labelled = Object.assign({}, person, { search: { label: p$ => p$.lastName.toUpperCase() } });

            assert.strictEqual(document(labelled, ADA).label, 'LOVELACE');
        })

        it('skips expired (ttl) items', function() {
            const expired = Object.assign({}, ADA, { ttl: Math.floor(Date.now() / 1000) - 60 });
            const future = Object.assign({}, ADA, { ttl: Math.floor(Date.now() / 1000) + 3600 });

            assert.strictEqual(document(person, expired), undefined);
            assert.ok(document(person, future));
        })
    })

    describe('memory engine', function() {
        let engine;

        beforeEach(async function() {
            engine = memory({ namespace: 'test' });

            await engine.upsert(person, [document(person, ADA), document(person, GRACE)]);
        })

        it('matches name prefixes', async function() {
            const hits = await engine.search({ q: 'lov', models: [person] });

            assert.deepStrictEqual(hits.map(h => h.id), ['p1']);
            assert.strictEqual(hits[0].projected.firstName, 'Ada');
        })

        it('requires every token to match', async function() {
            assert.strictEqual((await engine.search({ q: 'ada hop', models: [person] })).length, 0);
            assert.strictEqual((await engine.search({ q: 'grace hop', models: [person] })).length, 1);
        })

        it('matches email parts and phone numbers', async function() {
            assert.deepStrictEqual((await engine.search({ q: 'grace@navy', models: [person] })).map(h => h.id), ['p2']);
            assert.deepStrictEqual((await engine.search({ q: '(406) 555-12', models: [person] })).map(h => h.id), ['p1']);
            assert.deepStrictEqual((await engine.search({ q: '9876', models: [person] })).map(h => h.id), ['p2']);
            assert.deepStrictEqual((await engine.search({ q: '406555', models: [person] })).map(h => h.id).sort(), ['p1', 'p2']);
        })

        it('filters', async function() {
            const hits = await engine.search({ q: '406', models: [person], filters: { status: 'ACTIVE' } });

            assert.deepStrictEqual(hits.map(h => h.id), ['p1']);
        })
    })

    describe('indexer', function() {
        let engine;

        beforeEach(function() {
            engine = memory();
        })

        it('upserts inserted and modified items of searchable types', async function() {
            const other = { id: 'x1', type: 'TEST#OTHER', name: 'Ada' };

            const res = await index([streamRecord('INSERT', ADA), streamRecord('MODIFY', GRACE), streamRecord('INSERT', other)], { models: [person], engine });

            assert.deepStrictEqual(res, { upserted: 2, removed: 0 });
            assert.strictEqual(engine.documents(person).length, 2);
        })

        it('removes items that are removed or expired', async function() {
            await index([streamRecord('INSERT', ADA), streamRecord('INSERT', GRACE)], { models: [person], engine });

            const expired = Object.assign({}, GRACE, { ttl: Math.floor(Date.now() / 1000) - 1 });

            const res = await index([streamRecord('REMOVE', ADA), streamRecord('MODIFY', expired)], { models: [person], engine });

            assert.deepStrictEqual(res, { upserted: 0, removed: 2 });
            assert.strictEqual(engine.documents(person).length, 0);
        })

        it('applies the last record for an id in a batch', async function() {
            const renamed = Object.assign({}, ADA, { lastName: 'King' });

            await index([streamRecord('INSERT', ADA), streamRecord('REMOVE', ADA), streamRecord('MODIFY', renamed)], { models: [person], engine });

            const docs = engine.documents(person);

            assert.strictEqual(docs.length, 1);
            assert.strictEqual(docs[0].lastName, 'King');
        })
    })

    describe('reindex', function() {
        it('replaces the collection with current, unexpired items', async function() {
            const engine = memory();

            await engine.upsert(person, [{ id: 'stale', type: 'TEST#PERSON', label: 'Stale' }]);

            const expired = Object.assign({}, GRACE, { ttl: 1 });

            const count = await reindex(person, [ADA, expired], { engine });

            assert.strictEqual(count, 1);
            assert.deepStrictEqual(engine.documents(person).map(d => d.id), ['p1']);
        })
    })

    describe('typesense engine', function() {
        let calls;
        let responses;

        function fakeFetch(url, options) {
            calls.push({ url, method: options.method, body: options.body });

            const { status=200, body='' } = responses.shift() || {};

            return Promise.resolve({ status, ok: status < 300, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) });
        }

        let engine;

        beforeEach(function() {
            calls = [];
            responses = [];
            engine = typesense({ url: 'http://localhost:8108/', apiKey: 'xyz', namespace: 'app.test', fetch: fakeFetch });
        })

        it('creates a missing collection', async function() {
            responses.push({ status: 404 }, { body: {} });

            await engine.ensure([person]);

            assert.strictEqual(calls[1].method, 'POST');
            assert.strictEqual(calls[1].url, 'http://localhost:8108/collections');

            const created = JSON.parse(calls[1].body);

            assert.strictEqual(created.name, 'app_test__test_person');
            assert.ok(created.fields.some(f => f.name === 'phone_last4'));
            assert.ok(created.fields.find(f => f.name === 'status').facet);
            assert.strictEqual(created.fields.find(f => f.name === 'projected').index, false);
        })

        it('adds missing fields to an existing collection', async function() {
            responses.push({ body: { fields: [{ name: 'type' }, { name: 'label' }, { name: 'projected' }] } }, { body: {} });

            await engine.ensure([person]);

            assert.strictEqual(calls[1].method, 'PATCH');
            assert.ok(JSON.parse(calls[1].body).fields.some(f => f.name === 'email'));
        })

        it('imports documents as JSONL and reports failures', async function() {
            responses.push({ body: '{"success":true}\n{"success":true}' });

            assert.strictEqual(await engine.upsert(person, [document(person, ADA), document(person, GRACE)]), 2);
            assert.match(calls[0].url, /documents\/import\?action=upsert$/);
            assert.strictEqual(calls[0].body.split('\n').length, 2);

            responses.push({ body: '{"success":false,"error":"bad"}' });

            await assert.rejects(engine.upsert(person, [document(person, ADA)]), /bad/);
        })

        it('merges multi_search hits by score', async function() {
            responses.push({ body: { results: [{ hits: [
                { document: { id: 'p1', type: 'TEST#PERSON', label: 'Ada Lovelace', projected: '{"email":"a@b.c"}' }, text_match: 10 },
                { document: { id: 'p2', type: 'TEST#PERSON', label: 'Grace Hopper' }, text_match: 20 },
            ] }] } });

            const hits = await engine.search({ q: 'a', models: [person], filters: { status: 'ACTIVE' } });

            assert.deepStrictEqual(hits.map(h => h.id), ['p2', 'p1']);
            assert.deepStrictEqual(hits[1].projected, { email: 'a@b.c' });

            const [search] = JSON.parse(calls[0].body).searches;

            assert.strictEqual(search.collection, 'app_test__test_person');
            assert.strictEqual(search.query_by, 'label,nickname,firstName,lastName,email,phone,phone_last4');
            assert.strictEqual(search.query_by_weights, '3,1,2,3,1,1,1');
            assert.strictEqual(search.filter_by, 'status:=`ACTIVE`');
        })
    })
})
