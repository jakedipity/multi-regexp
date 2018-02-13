'use strict';

let counter = 0;

class Node {
    constructor(accepting) {
        this._transitions = new Map();
        this._accepting = accepting;
        this._id = counter++;
    }

    addTransition(symbol, node) {
        let insert = {
            target: node
        };
        if (!this._transitions.has(symbol)) {
            this._transitions.set(symbol, [insert]);
        } else {
            this._transitions.get(symbol).push(insert);
        }
    }

    deleteTransition(symbol) {
        if (this._transitions.has(symbol)) {
            this._transitions.delete(symbol);
        }
    }

    getAllNonDeterministicTransitions() {
        let transitions = [];
        this._getAllNonDeterministicTransitions(transitions, new Map());
        return transitions;
    }

    getTransitions(symbol) {
        if (this._transitions.has(symbol)) {
            return this._transitions.get(symbol);
        }

        return this._transitions.get('$REMAINING');
    }

    hasTransition(symbol) {
        return this._transitions.has(symbol);
    }

    forEachTransition(func) {
        for (let [transitionKey, transitionData] of this._transitions.entries()) {
            func(transitionKey, transitionData);
        }
    }

    getId() {
        return this._id;
    }

    isAccepting() {
        return this._accepting;
    }

    isNonDeterministicAccepting() {
        return this._isNonDeterministicAccepting(new Map());
    }

    _isNonDeterministicAccepting(seenNodes) {
        if (seenNodes.has(this)) {
            return false;
        }
        seenNodes.set(this, '');

        if (this._accepting === true) {
            return this._accepting;
        }

        let ret = false;
        if (this.hasTransition('$EMPTY')) {
            this.getTransitions('$EMPTY').forEach((transition) => {
                if (transition.target._isNonDeterministicAccepting(seenNodes)) {
                    ret = true;
                }
            });
        }
        return ret;
    }

    _getAllNonDeterministicTransitions(transitions, seenNodes) {
        if (seenNodes.has(this)) {
            return;
        }

        this.forEachTransition((transitionKey, transitionData) => {
            transitionData.forEach((transition) => {
                if (transitionKey === '$EMPTY') {
                    transition.target._getAllNonDeterministicTransitions(transitions, new Map([...seenNodes.entries()].concat([[this, '']])));
                } else {
                    transitions.push({
                        key: transitionKey
                        , target: transition.target
                    });
                }
            });
        });
    }

    _collect(collection) {
        if (collection.includes(this)) {
            return;
        }

        collection.push(this);
        this.forEachTransition((transitionKey, transitionData) => {
            transitionData.forEach((subData) => {
                subData.target._collect(collection);
            });
        });
    }
};

module.exports = Node;
