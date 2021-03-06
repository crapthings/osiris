const _ = require('lodash');
const MAX_EVENTS = 1000;

class EventSource {
    constructor(db, aggregate = {}) {
        this.db = db;
        this.aggregate = aggregate;
    }

    onEvent(evt) {
        return this.db.insertEvent(evt);
    }

    customizer(objValue, srcValue, key) {
        if (this.aggregate[key]) {
            return Number(objValue || 0) + Number(srcValue || 0);
        }
        //TODO - merge objects if objValue srcValue are objects
        return objValue;
    }

    getState(context) {
        return this.db
            .getSnapshot(context)
            .then(snapshot => {
                return this.db
                    .getEvents(context, snapshot.timestamp)
                    .then(events => {
                        if (snapshot.timestamp) {
                            return events.filter(e => e.timestamp > snapshot.timestamp || e.isSnapshot);
                        }
                        return events;
                    })
                    .then((events = []) => {
                        const state = events
                            .reduce((acc, cur) => {
                                const obj = _.mergeWith(cur, acc, this.customizer.bind(this));
                                return obj;
                            }, {});

                        state.timestamp = _.last(events).timestamp;

                        // create a snapshot after a given number of events have been added
                        if (events.length > MAX_EVENTS) {
                            this.snapshot(context);
                        }
                        return state;
                    });
            });
    }

    snapshot(context) {
        return new Promise(resolve => {
            this.getState(context).then(state => {
                state.isSnapshot = true;
                this.onEvent(state);
                resolve(state);
            });
        });
    }
}

module.exports = EventSource;
