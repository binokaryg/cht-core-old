//
// Asynchronously perform non-essential background cleanup based on following the changes feed.
//
// Changes should be repeatable as we only store progress after every batch
//
const db = require('../db');
const metadata = require('../lib/metadata');
const logger = require('../lib/logger');

const BATCH = 1000;

const getChanges = () => {
  return metadata.getBackgroundCleanupSeq()
    .then(seq => {
      return db.medic.changes({
        since: seq,
        limit: BATCH
      }).then(changes => {
        const readableSeq = seq.split('-')[0];
        const readableLastSeq = changes.last_seq.split('-')[0];
        logger.info(`Background cleanup batch: ${readableSeq} -> ${readableLastSeq} (${changes.results.length})`);

        return {
          changes: changes.results,
          checkpointSeq: changes.last_seq,
          more: changes.results.length === BATCH
        };
      });
    });
};

const deleteInfoDocs = changes => {
  const infodDocIds = changes.filter(c => c.deleted).map(c => c.id + '-info');

  if (!infodDocIds.length) {
    return Promise.resolve();
  }

  return db.sentinel.allDocs({
    keys: infodDocIds
  }).then(results => {
    const deletedStubs = results.rows.filter(r => !r.error).map(r => ({
      _id: r.id,
      _rev: r.value.rev,
      _deleted: true
    }));

    return db.sentinel.bulkDocs(deletedStubs);
  });
};

const deleteReadDocs = changes => {
  const deletedDocIds = changes.filter(c => c.deleted).map(c => c.id);

  if (!deletedDocIds.length) {
    return Promise.resolve();
  }

  // can't use array.flat() or array.flatMap() until node 11
  const possibleReadDocIds = deletedDocIds.reduce(
    (arr, id) => arr.concat(['report', 'message'].map(type => `read:${type}:${id}`)), []);

  return db.allDbs().then(dbs => {
    const userDbs = dbs.filter(dbName => dbName.startsWith(`${db.medicDbName}-user-`));

    // Intentionally not doing this in parallel because on larger systems we would fire off
    // thousands of requests at the same time. Would be great to use some kind of pressure based
    // work queue in the future
    let p = Promise.resolve();
    for (const udb of userDbs) {
      const userDb = db.get(udb);

      p = p
        .then(() => userDb.allDocs({ keys: possibleReadDocIds }))
        .then(results => {

          const deletedStubs = results.rows.filter(r => !r.error).map(r => ({
            _id: r.id,
            _rev: r.value.rev,
            _deleted: true
          }));

          if (!deletedStubs.length) {
            return;
          }

          return userDb.bulkDocs(deletedStubs);
        })
        .then(() => {
          db.close(userDb);
        })
        .catch(err => {
          db.close(userDb);
          throw err;
        });
    }

    return p;
  });
};

const batchLoop = () => {
  return module.exports._getChanges()
    .then(({changes, checkpointSeq, more}) => {
      return Promise.all([
        module.exports._deleteInfoDocs(changes),
        module.exports._deleteReadDocs(changes)
      ])
        .then(() => metadata.setBackgroundCleanupSeq(checkpointSeq))
        .then(() => more && batchLoop());
    });
};

module.exports = {
  execute: cb => batchLoop().then(() => cb()).catch(cb),
  _getChanges: getChanges,
  _deleteInfoDocs: deleteInfoDocs,
  _deleteReadDocs: deleteReadDocs
};
