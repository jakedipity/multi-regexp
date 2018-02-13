'use strict';

let automataCounter = 0;

class Automata {
    constructor(start, accepts) {
        this._start = start || null;
        this._accepts = accepts || [];
        this._id = automataCounter++;
    }

    print() {
        let collection = [];
        this._print(this._start, collection);
        console.log('START: ' + this._start._id);
        collection.forEach((child) => {
            let spoof = {};
            spoof.id = child.getId();
            spoof.accepting = child.isAccepting();
            spoof.transitions = {};
            child.forEachTransition((transitionKey, transitionData) => {
                spoof.transitions[transitionKey] = [];
                transitionData.forEach((subData) => {
                    spoof.transitions[transitionKey].push({
                        target: subData.target.getId()
                    });
                });
            });
            const util = require('util');
            console.log(util.inspect(spoof, false, null));
            console.log();
        });
    }

    _print(node, collection) {
        for (let i = 0; i < collection.length; ++i) {
            if (node._id === collection[i]._id) {
                return;
            }
        }

        collection.push(node);
        node.forEachTransition((transitionKey, transitionData) => {
            transitionData.forEach((childTransition) => {
                this._print(childTransition.target, collection);
            });
        });
    }
};

module.exports = Automata;
