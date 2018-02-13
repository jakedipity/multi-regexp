'use strict';

const MultiNode = require('./multi-node');

class MultiAutomata {
    constructor() {
        this._start = null;
        this._expressions = {};
        this._expressionCounter = 0;
    }

    addDfa(name, dfa) {
        if (this._start === null) {
            this._seed(name, dfa);
        } else {
            this._merge(name, dfa);
        }
    }

    print() {
        let collection = [];
        this._print(this._start, collection);
        console.log('START: ' + this._start._id);
        collection.forEach((child) => {
            let spoof = {};
            spoof.id = child.getId();
            spoof.accepting = child._accepting;
            spoof.transitions = {};
            child.forEachTransition((transitionKey, transitionData) => {
                spoof.transitions[transitionKey] = {
                    target: transitionData.target.getId()
                };
            });
            const util = require('util');
            console.log(util.inspect(spoof, false, null));
            console.log();
        });
    }

    scan(input) {
        let ret = new Array();
        let node = this._start;

        for (let i = 0, l = input.length; i < l; ++i) {
            let c = input.charAt(i);

            if (node.hasTransition(c)) {
                node = node.getTransition(c).target;
            } else {
                node = this._start;

                if (node.hasTransition(c)) {
                    node = node.getTransition(c).target;
                }
            }

            let l2 = node._accepting.length;
            while (l2--) {
                ret.push({
                    name: this._expressions[node._accepting[l2]]
                    , offset: i+1
                });
            }
        }
        return ret;
    }

    _print(node, collection) {
        for (let i = 0; i < collection.length; ++i) {
            if (node._id === collection[i]._id) {
                return;
            }
        }

        collection.push(node);
        node.forEachTransition((transitionKey, transitionData) => {
            this._print(transitionData.target, collection);
        });
    }

    _seed(name, dfa) {
        let id = this._expressionCounter++;
        this._expressions[id] = name;

        let referenceTable = new Map();
        let buildTable = new Map();

        let buildList = [dfa._start];
        let buildMap = new Map([[dfa._start, '']]);
        while (buildList.length !== 0) {
            let node = buildList.pop();
            referenceTable.set(node.getId(), node);
            buildTable.set(node.getId(), {
                node: new MultiNode(node.isAccepting() ? [id] : [])
                , transitions: []
            });
            node.forEachTransition((transitionKey, transitionData) => {
                let transition = transitionData[0];
                if (!buildMap.has(transition.target)) {
                    buildMap.set(transition.target);
                    buildList.push(transition.target);
                }

                buildTable.get(node.getId()).transitions.push({
                    key: transitionKey
                    , target: transition.target.getId()
                });
            });
        }

        [...buildTable.values()].forEach((buildData) => {
            buildData.transitions.forEach((transition) => {
                buildData.node.addTransition(transition.key, buildTable.get(transition.target).node);
            });
        });

        this._start = buildTable.get(dfa._start.getId()).node;
    }

    _merge(name, dfa) {
        let id = this._expressionCounter++;
        this._expressions[id] = name;

        let buildTable = new Map();

        let buildList = [[this._start, dfa._start]];
        let buildMap = new Map([[[this._start, dfa._start], '']]);
        while (buildList.length !== 0) {
            let group = buildList.pop();

            buildTable.set([group[0].getId(), group[1].getId()].join(','), {
                node: new MultiNode((group[1].isAccepting() ? [id] : []).concat(group[0]._accepting))
                , transitions: []
            });

            // let transitionKeys = new Set([...group[0]._transitions.keys()].concat([...group[1]._transitions.keys()]));
            let transitionKeys = new Set(Object.keys(group[0]._transitions).concat([...group[1]._transitions.keys()]));
            transitionKeys.forEach((transitionKey) => {
                let existing;
                if (group[0].hasTransition(transitionKey)) {
                    existing = group[0].getTransition(transitionKey).target;
                } else {
                    existing = this._start;
                }

                let merging;
                if (group[1].hasTransition(transitionKey)) {
                    merging = group[1].getTransitions(transitionKey)[0].target;
                } else {
                    merging = dfa._start;
                }

                if (!buildMap.has([existing.getId(), merging.getId()].join(','))) {
                    buildList.push([existing, merging]);
                    buildMap.set([existing.getId(), merging.getId()].join(','));
                }

                buildTable.get([group[0].getId(), group[1].getId()].join(',')).transitions.push({
                    key: transitionKey
                    , target: [existing.getId(), merging.getId()].join(',')
                });
            });
        }

        [...buildTable.values()].forEach((buildData) => {
            buildData.transitions.forEach((transition) => {
                buildData.node.addTransition(transition.key, buildTable.get(transition.target).node);
            });
        });

        this._start = buildTable.get([this._start.getId(), dfa._start.getId()].join(',')).node;
    }
}

module.exports = MultiAutomata;
