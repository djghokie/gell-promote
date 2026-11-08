# gell-mail

Outbox for email sent by gell events: an event queues a `MAIL#MESSAGE` in its own transaction instead of sending,
and the message is sent after the transaction commits - nothing is emailed for a change that did not happen.

- `event/queue` - effect: puts the message (and a `MAIL#REFERENCE` for each extra record it is about) in `$txn`
- `event/deliver` - effect: sends one QUEUED message and records SENT / FAILED; skips messages already delivered
- `event/flush` - effect: delivers every message still QUEUED (backstop for the stream Lambda)
- `snapshot/messages` - the emails about a record (its parent, or a referenced record), newest first
- `snapshot/message` - one email in full

Delivery is triggered by the session table's DynamoDB stream (INSERT of `MAIL#MESSAGE`), see `ps-lambda/mailer.js`.
Snapshots don't define roles - applications register them with `gell-dispatch/util/restrict`.
