# `gell-auth`

_supports `next-uath` based authentication/authorization setups_

## Users

### Single Application Ecosystems

* refers to single tenant, single application setups
* all `user`s belong to the same `namespace`
    * `namespace` is not explicitly defined

### Namespaced Ecosystems

## Sign In

* application `user` presents credentials
    * system then resolves credentials to a `user`

### Google

* uses email address to sign in

### Password-less

* used in testing scenarios in lower environments
* optionally allows user to create a `user` account on the fly
* `user` identified by `userId`
    * typically an email address