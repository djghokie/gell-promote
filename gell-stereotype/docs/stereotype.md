# `gell` stereotypes

## Concepts

* `stereotype`: collection of types, business logic (actions and snapshots), named queries and operations, etc
    * building block intended to be extended
* `extension`: series of types, queries, actions, etc that inherit from one or more `stereotype`s
    * maybe this should be called `feature`

## Example

* `stereotype` named "workflow"
    * defines a type "GELL#WORKFLOW"
    * defines `action`s for transitioning between workflow states
    * defines `snapshot`s for retrieving `workflow`s by `id`, by `status`, etc
    * defines named queries for retrieving `workflow`s by `status`, etc
    * exposes configuration attributes that `extension`s can use to change behaviors
* `extension` named "application"
    * represents an employment application for a project
    * extends the `workflow` stereotype, inheriting `actions`, `snapshot`s, `query`s, etc
    * extends the `workflow` type and adds additional attributes specific to employement applications

## Implementation Notes

* `stereotype` implementations, like `type`s, `action`s, etc will be a combination of code and metadata
* likely will require a `registry` similar to `type`s registry
* dispatching invocations of extension `action`s, `snapshot`s, etc by name will require `bus` logic that resolves the name to an inherited implementation

## Brainstorm

* might make sense to put all of this code in `gell-domain`
    * altho much of the stereotype features are related to actions and snapshots
* `stereotype` extensions should be able to provide configuration
    * said another way, a `stereotype` should expose configuration attributes
* clearly, a declarative approach will be used to define an `extension`
* `stereotype` can define additional capabilities
    * search indexing
    * metric generation
    * etc

### Stereotypes

#### `item`

* base `stereotype`
* minimal attributes
    * `id`
    * `type`
    * `initiatedTs`
    * `updatedTs`
    * `parentId`?
        * this might be for `session`
* queries
    * `lookup`
    * `activity`

#### `session`

#### `asset`

#### `ledger`

### Possible Stereotypes

_haven't thought through this too much_

* `log`
    * timestamped "log entries"
    * i.e. a call log
    * capturing "activity" associated with some session
    * is this the same as session?
* `workflow`
    * transition events
    * querying by status