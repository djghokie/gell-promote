# gell-search (v2)

Full-text search for gell entities, driven by the domain model. Replaces the v1 approach (`gell-search` on npm:
one DynamoDB row per term in a `search` table, prefix match on a single term only).

## Pieces

| module | does |
|---|---|
| `schema.js` | search fields of a model (from `searchable` attributes), collection names |
| `document.js` | entity snapshot → search document (normalized values + projection); `undefined` when expired (`ttl`) |
| `engine/typesense.js` | Typesense over REST (`fetch`); one collection per model |
| `engine/memory.js` | same interface, in memory; for unit tests |
| `indexer.js` | DynamoDB stream records → `upsert` / `remove`, batched per model |
| `reindex.js` | drop + rebuild one model's collection from its snapshots |
| `snapshot/query.js` | `search.query` snapshot; needs `searchEngine` + `searchModels` dependencies; defines no roles |

Engine interface: `ensure(models)`, `drop(model)`, `upsert(model, docs)`, `remove(model, ids)`,
`search({ q, models, filters, limit })` → `[{ id, type, label, projected, score }]`.

## Declaring search on a model

```js
const model = {
    name: 'CRM#CONTACT',
    search: { label: c$ => `${c$.firstName} ${c$.lastName}` },  // optional; defaults to name / first+last / email
    attributes: {
        lastName: { type: 'string', searchable: { index: true, weight: 3, project: true } },
        email:    { type: 'email',  searchable: { index: true, project: true } },   // index: 'email'
        phone:    { type: 'phone',  searchable: { index: true, project: true } },   // index: 'phone' (+ last 4)
        status:   { type: 'string', searchable: { filter: true } },
    }
}
```

- `index`: `true` (`text`, or the attribute's `email` / `phone` type), `'text'`, `'keyword'`, `'email'`, `'phone'`
- `weight`: ranking weight (default 1)
- `filter`: exact-match filter field
- `project`: returned on the hit (`hit.projected`) so result lists need no extra lookup

## Wiring an application

1. **Dependencies**: define `searchModels` (the models to index) and `searchEngine`:
   ```js
   const typesense = require('gell-promote/gell-search/engine/typesense');

   exports.searchModels = z => [contact.model];
   exports.searchEngine = singleton(z => typesense({ url, apiKey, namespace }));  // namespace per environment
   ```
   Tests use `engine/memory` instead.
2. **Stream indexer**: a Lambda on the table's DynamoDB stream:
   ```js
   const index = require('gell-promote/gell-search/indexer');

   exports.handler = event => index(event.Records, { models, engine, logger });
   ```
3. **Rebuild**: for each model, `reindex(model, items$, { engine, logger })` with all of its snapshots (initial
   load, changed searchable attributes, new engine).
4. **Query**: register `snapshot/query.js`, adding the application's roles to its api trigger:
   ```js
   const restrict = require('gell-promote/gell-dispatch/util/restrict');

   registry_.register(restrict(require('gell-promote/gell-search/snapshot/query'), ['admin']));
   ```

## WIP

- no TENANT isolation; collections are separated by namespace only
- reindex leaves the collection empty while it rebuilds; an alias swap would avoid that
- schema changes only add fields; a changed field type needs a reindex
