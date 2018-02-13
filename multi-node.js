'use strict';

let counter = 0;

class MultiNode {
    constructor(accepting) {
        // this._transitions = new Map();
        this._transitions = {};
        this._accepting = accepting || [];
        this._id = counter++;
    }

    getId() {
        return this._id;
    }

    isAccepting() {
        return this._accepting.length !== 0;
    }

    addTransition(symbol, node) {
        let insert = {
            target: node
        };

        // this._transitions.set(symbol, insert);
        this._transitions[symbol] = insert;
    }

    getTransition(symbol) {
        // return this._transitions.get(symbol);
        return this._transitions[symbol];
    }

    hasTransition(symbol) {
        // return this._transitions.has(symbol);
        return !(this._transitions[symbol] === undefined);
        // return symbol in this._transitions;
        // return this._transitions.hasOwnProperty(symbol);
    }

    forEachTransition(func) {
        Object.keys(this._transitions).forEach((transitionKey) => {
            func(transitionKey, this._transitions[transitionKey]);
        });
    }
};

module.exports = MultiNode;
