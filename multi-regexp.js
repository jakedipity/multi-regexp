'use strict';

/*
 * This is the grammar for the regex parser in a yacc format:
 *
 * Start            : Regex
 *                  ;
 *
 * Regex            : Term '|' Regex
 *                  ; Term
 *
 * Term             : Factor Term
 *                  | %empty
 *                  ;
 *
 * Factor           : Base '*'
 *                  | Base '+'
 *                  | Base '?'
 *                  | Base
 *                  ;
 *
 * Base             : CHAR
 *                  | '\' CHAR
 *                  | '(' Regex ')'
 *                  | '[' CharSet ']'
 *                  ;
 *
 * CharSet          : CHAR ...
 *                  ;
 */

let counter = 0;

class Node {
    constructor(accepting) {
        this._transitions = new Map();
        this._accepting = accepting;
        this._id = counter++;
    }

    addTransition(symbol, node, resets) {
        let insert = {
            target: node
            , resets: resets || false
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
        this._getAllNonDeterministicTransitions(false, transitions, new Map());
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

    _getAllNonDeterministicTransitions(currentResets, transitions, seenNodes) {
        if (seenNodes.has(this)) {
            return;
        }

        this.forEachTransition((transitionKey, transitionData) => {
            transitionData.forEach((transition) => {
                if (transitionKey === '$EMPTY') {
                    transition.target._getAllNonDeterministicTransitions(transition.resets || currentResets, transitions, new Map([...seenNodes.entries()].concat([[this, '']])));
                } else {
                    transitions.push({
                        key: transitionKey
                        , target: transition.target
                        , resets: transition.resets || currentResets
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
                        , resets: subData.resets
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

class DeterministicAutomata extends Automata {
    constructor(start, accepts) {
        super(start, accepts);
    }

    static fromNFA(automata) {
        let conversionTable = {};
        let referenceTable = {};
        referenceTable[automata._start._id.toString()] = automata._start;
        let checks = [[automata._start]];
        let alreadyCheckingMap = new Map();
        while (checks.length !== 0) {
            let nodes = checks.pop();
            nodes.sort((a, b) => {
                return a._id - b._id;
            });
            let id = '';
            for (let i = 0; i < nodes.length; ++i) {
                id += nodes[i]._id.toString();
                if (i !== nodes.length - 1) {
                    id += ',';
                }
            }
            conversionTable[id] = {
                transitions: {}
                , accepting: false
                , starting: false
            };
            while (nodes.length !== 0) {
                let node = nodes.pop();

                if (node.isNonDeterministicAccepting()) {
                    conversionTable[id].accepting = true;
                }

                node.getAllNonDeterministicTransitions().forEach((transition) => {
                    if (!conversionTable[id].transitions[transition.key]) {
                        conversionTable[id].transitions[transition.key] = [];
                    }

                    if (!referenceTable[transition.target.getId()]) {
                        referenceTable[transition.target.getId()] = transition.target;
                    }

                    let pushFlag = true;
                    conversionTable[id].transitions[transition.key].forEach((existingTransition) => {
                        if (existingTransition.target === transition.target.getId()) {
                            pushFlag = false;
                        }
                        if (existingTransition.resets === true && transition.resets === false) {
                            existingTransition.resets = false;
                        }
                    });

                    if (pushFlag) {
                        conversionTable[id].transitions[transition.key].push({
                            target: transition.target.getId()
                            , resets: transition.resets
                        });
                    }
                });
            }

            Object.keys(conversionTable[id].transitions).forEach((key) => {
                let newRow = [];
                let checkId = '';
                let checkResets = true;
                conversionTable[id].transitions[key].sort((a, b) => {
                    return a.target - b.target;
                });
                for (let i = 0; i < conversionTable[id].transitions[key].length; ++i) {
                    checkId += conversionTable[id].transitions[key][i].target;
                    if (!conversionTable[id].transitions[key][i].resets) {
                        checkResets = false;
                    }
                    if (i !== conversionTable[id].transitions[key].length - 1) {
                        checkId += ',';
                    }
                    newRow.push(referenceTable[conversionTable[id].transitions[key][i].target]);
                }
                conversionTable[id].transitions[key] = [{
                    target: checkId
                    , resets: checkResets
                }];
                if (!conversionTable[checkId] && !alreadyCheckingMap.has(checkId)) {
                    checks.push(newRow);
                    alreadyCheckingMap.set(checkId, '');
                }
            });
        }
        conversionTable[automata._start._id].starting = true;
        let buildTable = {};
        let rootNode;
        let accepts = [];
        Object.keys(conversionTable).forEach((finalNodeId) => {
            buildTable[finalNodeId] = new Node(conversionTable[finalNodeId].accepting);
            if (conversionTable[finalNodeId].starting) {
                rootNode = buildTable[finalNodeId];
            }

            if (conversionTable[finalNodeId].accepting) {
                accepts.push(buildTable[finalNodeId]);
            }
        });

        Object.keys(conversionTable).forEach((finalNodeId) => {
            Object.keys(conversionTable[finalNodeId].transitions).forEach((key) => {
                let transitionNode = buildTable[conversionTable[finalNodeId].transitions[key][0].target];
                buildTable[finalNodeId].addTransition(key, transitionNode, conversionTable[finalNodeId].transitions[key][0].resets);
            });
        });

        return new DeterministicAutomata(rootNode, accepts);
    }

    static minimize(automata) {
        let pairTable = {};
        let referenceTable = {};
        let nodes = [];
        let startId = automata._start._id;
        automata._start._collect(nodes);
        nodes.sort((a, b) => {
            return b._id - a._id; // Build backwards so pair table can be built linearly forwards - trust me
        });
        while (nodes.length !== 0) {
            let node = nodes.pop();
            referenceTable[node._id] = node;
            for (let i = nodes.length-1; i >= 0; --i) {
                let id = node._id + ',' + nodes[i]._id;
                pairTable[id] = node._accepting ? !nodes[i]._accepting : nodes[i]._accepting; // Simulate XOR
            }
        }
        let delta = 1;
        while (delta !== 0) {
            delta = 0;
            Object.keys(pairTable).forEach((pair) => {
                if (pairTable[pair] === true) {
                    return;
                }
                let pairSplit = pair.split(',');
                let leftNode = referenceTable[pairSplit[0]];
                let rightNode = referenceTable[pairSplit[1]];
                let transitionKeys = new Set([...leftNode._transitions.keys()].concat([...rightNode._transitions.keys()]));
                transitionKeys.forEach((transitionKey) => {
                    let leftId;
                    let leftResets = false;
                    let rightId;
                    let rightResets = false;
                    if (!leftNode.hasTransition(transitionKey)) {
                        leftId = startId;
                    } else {
                        let transition = leftNode.getTransitions(transitionKey)[0];
                        leftId = transition.target._id;
                        leftResets = transition.resets;
                    }

                    if (!rightNode.hasTransition(transitionKey)) {
                        rightId = startId;
                    } else {
                        let transition = rightNode.getTransitions(transitionKey)[0];
                        rightId = transition.target._id;
                        rightResets = transition.resets;
                    }

                    if (leftId > rightId) {
                        let tmp = leftId;
                        leftId = rightId;
                        rightId = tmp;
                    }

                    let transitionSplit = [leftId, rightId];
                    transitionSplit.sort((a, b) => {
                        return a._id - b._id;
                    });
                    let result = pairTable[transitionSplit.join(',')] || leftResets !== rightResets;
                    if (result) {
                        pairTable[pair] = result;
                        ++delta;
                    }
                });
            });
        }
        let groupTable = {};
        let pairs = Object.keys(pairTable);
        while (pairs.length !== 0) {
            let pair = pairs.pop();
            if (pairTable[pair]) {
                continue;
            }
            let split = pair.split(',');
            let leftId = split[0];
            let rightId = split[1];

            //TODO: evaluate whether this is really needed. Basically doesn't let start node get paired up with anyone.
            if (leftId == automata._start.getId() || rightId == automata._start.getId()) {
                continue;
            }

            if (!groupTable[leftId] && !groupTable[rightId]) {
                groupTable[leftId] = [leftId, rightId];
                groupTable[rightId] = groupTable[leftId];
            } else if (!groupTable[leftId] || !groupTable[rightId] && !(groupTable[leftId] && groupTable[rightId])) {
                let isMember = true;
                let major = groupTable[leftId] ? leftId : rightId;
                let minor = groupTable[leftId] ? rightId : leftId;
                for (let i = 0; i < groupTable[major].length; ++i) {
                    let checkLeft = groupTable[major][i] < minor ? groupTable[major][i] : minor;
                    let checkRight = groupTable[major][i] < minor ? minor : groupTable[major][i];
                    if (pairTable[checkLeft + ',' + checkRight]) {
                        isMember = false;
                    }
                }

                if (isMember) {
                    groupTable[major].push(minor);
                    groupTable[minor] = groupTable[major];
                }
            }
        }

        Object.keys(referenceTable).forEach((key) => {
            if (!groupTable[key]) {
                groupTable[key] = [key];
            }
        });

        let acceptNodes = [];
        let buildTable = {};
        Object.keys(groupTable).forEach((key) => {
            let node = new Node(referenceTable[key]._accepting);
            if (node._accepting) {
                acceptNodes.push(node);
            }
            groupTable[key].sort((a, b) => {
                return a - b;
            });
            buildTable[groupTable[key].join(',')] = node;
        });

        Object.keys(groupTable).forEach((key) => {
            let node = buildTable[groupTable[key].join(',')];
            groupTable[key].forEach((unit) => {
                referenceTable[unit].forEachTransition((transitionKey, transitionData) => {
                    if (node.hasTransition(transitionKey)) {
                        return;
                    }

                    node.addTransition(transitionKey, buildTable[groupTable[referenceTable[unit].getTransitions(transitionKey)[0].target._id]], referenceTable[unit].getTransitions(transitionKey)[0].resets);
                });
            });
        });

        return new DeterministicAutomata(buildTable[groupTable[automata._start._id.toString()].join(',')], acceptNodes);
    }
}

// We can build an automata from regular expression using Thompson's Construction
class NonDeterministicAutomata extends Automata {
    constructor(start, accepts) {
        super(start, accepts);
    }

    static buildInput(symbols) {
        let automata = new NonDeterministicAutomata(new Node(false), [new Node(true)]);
        symbols.forEach((symbol) => {
            automata._start.addTransition(symbol, automata._accepts[0]);
        });
        return automata;
    }

    // TODO: Allow this to handle an arbitrary number of expressions e.g. a|b|c
    static buildUnion(left, right) {
        let automata = new NonDeterministicAutomata(new Node(false), [new Node(true)]);
        left._tailAccepts(automata._accepts[0]);
        right._tailAccepts(automata._accepts[0]);
        automata._start.addTransition('$EMPTY', left._start);
        automata._start.addTransition('$EMPTY', right._start);
        return automata;
    }

    static buildDisjunction(left, right) {
        let automata = new NonDeterministicAutomata(left._start, right._accepts);
        left._mergeAccepts(right._start);
        return automata;
    }

    static buildKleeneStar(wraps) {
        let automata = new NonDeterministicAutomata(new Node(false), [new Node(true)]);
        automata._start.addTransition('$EMPTY', automata._accepts[0]);
        automata._start.addTransition('$EMPTY', wraps._start);
        wraps._tailAccepts(wraps._start);
        wraps._tailAccepts(automata._accepts[0]);
        return automata;
    }

    static buildExtPlus(wraps) {
        let automata = new NonDeterministicAutomata(new Node(false), [new Node(true)]);
        automata._start.addTransition('$EMPTY', wraps._start);
        wraps._tailAccepts(wraps._start);
        wraps._tailAccepts(automata._accepts[0]);
        return automata;
    }

    static buildExtZeroOrOne(wraps) {
        let automata = new NonDeterministicAutomata(new Node(false), [new Node(true)]);
        automata._start.addTransition('$EMPTY', automata._accepts[0]);
        automata._start.addTransition('$EMPTY', wraps._start);
        wraps._tailAccepts(automata._accepts[0]);
        return automata;
    }

    normalize() {
        /*this._accepts.forEach((node) => {
            node.addTransition('$EMPTY', this._start, true);
        });
        */

        let seenNodes = {};
        this._normalizeStart(seenNodes, this._start);
        Object.keys(seenNodes).forEach((nodeId) => {
            if (seenNodes[nodeId] !== 0) {
                this._normalize(seenNodes, seenNodes[nodeId]);
            }
        });
    }

    _normalizeStart(seenNodes, node) {
        if (seenNodes[node.getId()] !== undefined) {
            return;
        }
        seenNodes[node.getId()] = node;

        if (node.hasTransition('$EMPTY')) {
            node.getTransitions('$EMPTY').forEach((transitionData) => {
                this._normalizeStart(seenNodes, transitionData.target);
            });
        }
    }

    _normalize(seenNodes, node, isStarted) {
        if (seenNodes[node.getId()] === 0) {
            return;
        }
        let shouldRoute = seenNodes[node.getId()] === undefined;
        seenNodes[node.getId()] = 0;

        node.forEachTransition((transitionKey, transitionDatas) => {
            transitionDatas.forEach((transitionData) => {
                this._normalize(seenNodes, transitionData.target);
            });
        });

        if (shouldRoute) {
            node.addTransition('$EMPTY', this._start, true);
        }
    }

    _tailAccepts(tail) {
        this._accepts.forEach((node) => {
            node._accepting = false;
            if (!node.hasTransition('$EMPTY')) {
                node.addTransition('$EMPTY', tail);
            } else {
                node.addTransition('$EMPTY', tail);
            }
        });
    }

    _mergeAccepts(merge) {
        this._accepts.forEach((node) => {
            node._accepting = false;
            merge.forEachTransition((transitionKey, transitionData) => {
                transitionData.forEach((childTransitionData) => {
                    node.addTransition(transitionKey, childTransitionData.target);
                });
            });
        });
    }
};

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

    addTransition(symbol, node, starts, destroys, resets) {
        let insert = {
            target: node
            , starts: starts || []
            , destroys: destroys || []
            , resets: resets || []
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

class MultiAutomata {
    constructor() {
        this._start = null;
        this._expressions = {};
        this._expressionCounter = 0;
        this._captureOffsets = {};
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
                    , starts: transitionData.starts
                    , destroys: transitionData.destroys
                    , resets: transitionData.resets
                };
            });
            const util = require('util');
            console.log(util.inspect(spoof, false, null));
            console.log();
        });
    }

    _handleTransition(node, symbol, offset) {
        let transitionData = node.getTransition(symbol);
        let l = transitionData.starts.length;
        /*
        while (l--) {
            this._captureOffsets[transitionData.starts[l]] = offset;
        }
        l = transitionData.resets.length;
        while (l--) {
            this._captureOffsets[transitionData.resets[l]] = offset;
        }
        */
        return transitionData.target;
    }

    scan(input) {
        let ret = new Array();
        let node = this._start;

        for (let i = 0, l = input.length; i < l; ++i) {
            let c = input.charAt(i);

            if (node.hasTransition(c)) {
                node = this._handleTransition(node, c, i);
            } else {
                node = this._start;

                /*
                if (node.hasTransition(c)) {
                    node = this._handleTransition(node, c, i);
                }
                */
            }

            let l2 = node._accepting.length;
            while (l2--) {
                /*
                ret.push({
                    name: this._expressions[node._accepting[l2]]
                    , value: input.slice(this._captureOffsets[node._accepting[l2]], i+1)
                    , start: this._captureOffsets[node._accepting[l2]]
                    , end: i+1
                });
                */
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
        this._captureOffsets[id] = 0;

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

                let starts = node.getId() === dfa._start.getId() ? [id] : [];

                buildTable.get(node.getId()).transitions.push({
                    key: transitionKey
                    , target: transition.target.getId()
                    , starts: starts
                    , resets: transition.resets === true ? [id] : []
                });
            });
        }

        [...buildTable.values()].forEach((buildData) => {
            buildData.transitions.forEach((transition) => {
                buildData.node.addTransition(transition.key, buildTable.get(transition.target).node, transition.starts, [], transition.resets);
            });
        });

        this._start = buildTable.get(dfa._start.getId()).node;
    }

    _merge(name, dfa) {
        let id = this._expressionCounter++;
        this._expressions[id] = name;
        this._captureOffsets[id] = 0;

        let referenceTable = new Map();
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
                let existingStarts = [];
                let existingDestroys = [];
                let existingResets = [];
                if (group[0].hasTransition(transitionKey)) {
                    existing = group[0].getTransition(transitionKey).target;
                    existingStarts = group[0].getTransition(transitionKey).starts;
                    existingDestroys = group[0].getTransition(transitionKey).destroys;
                    existingResets = group[0].getTransition(transitionKey).resets;
                } else {
                    existing = this._start;
                    existingDestroys = Object.keys(this._expressions);
                    existingDestroys.splice(existingDestroys.indexOf(id), 1);
                }

                let merging;
                let mergingStarts = [];
                let mergingDestroys = [];
                let mergingResets = [];
                if (group[1].hasTransition(transitionKey)) {
                    merging = group[1].getTransitions(transitionKey)[0].target;
                    mergingStarts = group[1].getId() === dfa._start.getId() ? [id] : [];
                    mergingResets = group[1].getTransitions(transitionKey)[0].resets === true ? [id] : [];
                } else {
                    merging = dfa._start;
                    mergingDestroys = [id];
                }

                if (!buildMap.has([existing.getId(), merging.getId()].join(','))) {
                    buildList.push([existing, merging]);
                    buildMap.set([existing.getId(), merging.getId()].join(','));
                }

                buildTable.get([group[0].getId(), group[1].getId()].join(',')).transitions.push({
                    key: transitionKey
                    , target: [existing.getId(), merging.getId()].join(',')
                    , starts: existingStarts.concat(mergingStarts)
                    , destroys: existingDestroys.concat(mergingDestroys)
                    , resets: existingResets.concat(mergingResets)
                });
            });
        }

        [...buildTable.values()].forEach((buildData) => {
            buildData.transitions.forEach((transition) => {
                buildData.node.addTransition(transition.key, buildTable.get(transition.target).node, transition.starts, transition.destroys, transition.resets);
            });
        });

        this._start = buildTable.get([this._start.getId(), dfa._start.getId()].join(',')).node;
    }
}


class RegexParser {
    constructor() {
        // stuff
    }

    parse(input) {
        this._input = input;
        this._index = 0;
        return this._grammarStart();
    }

    _peekInput(peeks) {
        if (!this._isMore()) {
            return false;
        }

        if (typeof peeks === typeof []) {
            let peek = this._input.charAt(this._index);
            for (let i = 0; i < peeks.length; ++i) {
                if (peek === peeks[i]) {
                    return true;
                }
            }
            return false;
        } else {
            return this._input.charAt(this._index) === peeks;
        }
    }

    _getInput() {
        return this._input.charAt(this._index);
    }

    _isMore() {
        return this._index < this._input.length;
    }

    _acceptInput(accept) {
        if (!accept || this._peekInput(accept)) {
            ++this._index;
            return true;
        }

        return false;
    }

    _grammarStart() {
        if (this._peekRegex()) {
            let regex = this._grammarRegex();
            if (!this._isMore()) {
                regex.normalize();
                return regex;
            }
        }

        throw new 'Exception placeholder';
    }

    // TODO: Replace the tail recursion with a loop
    _grammarRegex() {
        if (this._peekTerm()) {
            let term = this._grammarTerm();
            if (this._acceptInput('|')) {
                if (this._peekRegex()) {
                    return NonDeterministicAutomata.buildUnion(term, this._grammarRegex());
                }
            } else {
                return term;
            }
        }

        throw new 'Exception placeholder';
    }

    _peekRegex() {
        return this._peekTerm();
    }

    _grammarTerm() {
        let factor = null;
        while (this._peekFactor()) {
            if (!factor) {
                factor = this._grammarFactor();
            } else {
                factor = NonDeterministicAutomata.buildDisjunction(factor, this._grammarFactor());
            }
        }

        if (!factor) {
            throw new 'Exception placeholder';
        }

        return factor;
    }

    _peekTerm() {
        return true;
    }

    _grammarFactor() {
        if (this._peekBase()) {
            let base = this._grammarBase();
            if (this._acceptInput('*')) {
                return NonDeterministicAutomata.buildKleeneStar(base);
            } else if (this._acceptInput('+')) {
                return NonDeterministicAutomata.buildExtPlus(base);
            } else if (this._acceptInput('?')) {
                return NonDeterministicAutomata.buildExtZeroOrOne(base);
            }
            return base;
        }

        throw new 'Exception placeholder';
    }

    _peekFactor() {
        return this._peekBase();
    }

    _grammarBase() {
        if (this._acceptInput('(')) {
            if (this._peekRegex()) {
                let regex = this._grammarRegex();
                if (this._acceptInput(')')) {
                    return regex;
                }
            }
        } else if (this._acceptInput('[')) {
            if (this._peekCharSet()) {
                let charSet = this._grammarCharSet();
                if (this._acceptInput(']')) {
                    return NonDeterministicAutomata.buildInput(charSet);
                }
            }
        } else {
            this._acceptInput('\\');

            let symbol = this._getInput();
            this._acceptInput();
            return NonDeterministicAutomata.buildInput([symbol]);
        }

        throw new 'Exception placeholder';
    }

    _peekBase() {
        return !this._peekInput(['|', ')', '*', ']', '+', '?']) && this._isMore();
    }

    _grammarCharSet() {
        let ranges = {
            lowerAlpha: {
                root: 'abcdefghijklmnopqrstuvwxyz'
            }
            , upperAlpha: {
                root: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            }
            , allAlpha: {
                root: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
            }
            , numeric: {
                root: '0123456789'
            }
        };

        Object.keys(ranges).forEach((rangeKey) => {
            let charSplit = ranges[rangeKey].root.split('');
            ranges[rangeKey].list = charSplit;
            ranges[rangeKey].elements = {};
            for (let i = 0; i < charSplit.length; ++i) {
                ranges[rangeKey].elements[charSplit[i]] = i;
            }
        });

        let charSet = [];
        while (!this._peekInput(']')) {
            this._acceptInput('\\');
            let symbol = this._getInput();
            this._acceptInput();

            if (symbol === '-' && (!this._peekInput(']') && charSet.length !== 0)) {
                let lower = charSet.pop();
                let upper = this._getInput();
                this._acceptInput();
                let range;
                let rangeKeys = Object.keys(ranges);
                for (let i = 0; i < rangeKeys.length; ++i) {
                    if (ranges[rangeKeys[i]].elements[lower] !== undefined) {
                        range = rangeKeys[i];
                        break;
                    }
                }

                if (!range) {
                    throw new 'Exception placeholder!';
                }

                if (!ranges[range].elements[upper]) {
                    throw new 'Exception placeholder!';
                }

                let lowerVal = ranges[range].elements[lower];
                let upperVal = ranges[range].elements[upper];

                if (lowerVal > upperVal) {
                    throw new 'Exception placeholder!';
                }

                charSet = charSet.concat(ranges[range].list.slice(lowerVal, upperVal+1));
            } else {
                charSet.push(symbol);
            }
        }

        return charSet;
    }

    _peekCharSet() {
        return !this._peekInput([']']) && this._isMore();
    }
};


class MultiRegExp {
    constructor(regexes) {
        this._parser = new RegexParser();
        this._multiAutomata = new MultiAutomata();
        let l = regexes.length;
        while (l--) {
            let dfa = this._convert2Dfa(regexes[l][1]);
            this._multiAutomata.addDfa(regexes[l][0], dfa);
        }
    }

    search(input) {
        return this._multiAutomata.scan(input);
    }

    _convert2Dfa(regex) {
        let nfa = this._parser.parse(regex);
        let dfa = DeterministicAutomata.fromNFA(nfa);
        let minDfa = DeterministicAutomata.minimize(dfa);
        return minDfa;
    }
}

class Scanner {
    constructor(dfa) {
        this._dfa = dfa;
    }

    scan(input) {
        let ret = [];
        let node = this._dfa._start;
        let capture = '';
        if (this._dfa._start._accepts) {
            console.log('');
        }

        for (let i = 0; i < input.length; ++i) {
            let c = input.charAt(i);
            capture += c;

            if (node.hasTransition(c)) {
                let transitionData = node.getTransitions(c)[0];
                node = transitionData.target;
                if (transitionData.resets) {
                    capture = c;
                }
            } else {
                node = this._dfa._start;
                capture = '';
                if (node.hasTransition(c)) {
                    capture += c;
                    node = node.getTransitions(c)[0].target;
                }
            }

            if (node._accepting) {
                ret.push(capture);
            }
        }
        return ret;
    }
};

module.exports = MultiRegExp;

let parser = new RegexParser();
function build(regex) {
    let nfa = parser.parse(regex);
    let dfa = DeterministicAutomata.fromNFA(nfa);
    let minDfa = DeterministicAutomata.minimize(dfa);
    return minDfa;
}

let a = build('[a-zA-Z][a-zA-Z0-9_.\\+=:-]+@([0-9A-Za-z][0-9A-Za-z-]+)(.([0-9A-Za-z][0-9A-Za-z-]+))*');
let b = build('([0-9][0-9]?[0-9]?.)+[0-9][0-9]?[0-9]?');
let c = build('[Aa]lert|ALERT|[Tt]race|TRACE|[Dd]ebug|DEBUG|[Nn]otice|NOTICE|[Ii]nfo|INFO|[Ww]arn?(ing)?|WARN?(ING)?|[Ee]rr?(or)?|ERR?(OR)?|[Cc]rit?(ical)?|CRIT?(ICAL)?|[Ff]atal|FATAL|[Ss]evere|SEVERE|EMERG(ENCY)?|[Ee]merg(ency)?');


let multi = new MultiAutomata();
multi.addDfa('integer', b);
// multi.addDfa('testB', testB);
multi.addDfa('email', a);
multi.addDfa('log level', c);
// multi.print();

/*
let nfa = parser.parse('(a?b)*');
nfa.print();
*/

// nfa.print();
// let dfa = DeterministicAutomata.fromNFA(nfa);
// dfa.print();
// let minDfa = DeterministicAutomata.minimize(dfa);
// minDfa.print();

// console.log(multi.scan('+100-200 ab2+0cd'));

let samples = 50;
let tests = 50000;
let l = samples;
let running = 0;
let ret;
let input = '64.242.88.10 - - [07/Mar/2004:17:09:01 -0800] "GET /twiki/bin/search/Main/SearchResult?scope=text®ex=on&search=Joris%20*Benschop[^A-Za-z] HTTP/1.1" 200 4284';
console.log('Collecting %d samples of %s tests...', samples, tests.toLocaleString());
while (l--) {
    let start = new Date();
    let l2 = tests;
    while (l2--) {
        ret = multi.scan(input);
    }
    let end = new Date() - start;
    running += end;
}
ret.forEach((r) => {
    r.value = input.slice(r.start, r.end);
});
console.log(ret);
console.log('Average execution time: %sms\nExpected throughput: %s lines/s', (running/samples).toLocaleString(), (tests/(running/samples/1000)).toLocaleString());
