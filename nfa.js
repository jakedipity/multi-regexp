'use strict';

const Automata = require('./automata');
const Node = require('./node');

// We can build an automata from regular expression using Thompson's Construction
class Nfa extends Automata {
    constructor(start, accepts) {
        super(start, accepts);
    }

    static buildInput(symbols) {
        let automata = new Nfa(new Node(false), [new Node(true)]);
        symbols.forEach((symbol) => {
            automata._start.addTransition(symbol, automata._accepts[0]);
        });
        return automata;
    }

    // TODO: Allow this to handle an arbitrary number of expressions e.g. a|b|c
    static buildUnion(left, right) {
        let automata = new Nfa(new Node(false), [new Node(true)]);
        left._tailAccepts(automata._accepts[0]);
        right._tailAccepts(automata._accepts[0]);
        automata._start.addTransition('$EMPTY', left._start);
        automata._start.addTransition('$EMPTY', right._start);
        return automata;
    }

    static buildDisjunction(left, right) {
        let automata = new Nfa(left._start, right._accepts);
        left._mergeAccepts(right._start);
        return automata;
    }

    static buildKleeneStar(wraps) {
        let automata = new Nfa(new Node(false), [new Node(true)]);
        automata._start.addTransition('$EMPTY', automata._accepts[0]);
        automata._start.addTransition('$EMPTY', wraps._start);
        wraps._tailAccepts(wraps._start);
        wraps._tailAccepts(automata._accepts[0]);
        return automata;
    }

    static buildExtPlus(wraps) {
        let automata = new Nfa(new Node(false), [new Node(true)]);
        automata._start.addTransition('$EMPTY', wraps._start);
        wraps._tailAccepts(wraps._start);
        wraps._tailAccepts(automata._accepts[0]);
        return automata;
    }

    static buildExtZeroOrOne(wraps) {
        let automata = new Nfa(new Node(false), [new Node(true)]);
        automata._start.addTransition('$EMPTY', automata._accepts[0]);
        automata._start.addTransition('$EMPTY', wraps._start);
        wraps._tailAccepts(automata._accepts[0]);
        return automata;
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

module.exports = Nfa;
