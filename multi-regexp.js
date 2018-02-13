'use strict';

const RegexParser = require('./regex-parser');
const Dfa = require('./dfa');
const MultiAutomata = require('./multi-automata');

// TODO: Move scanning logic from MultiAutomata to here
class MultiRegexp {
    constructor(patterns) {
        this._parser = new RegexParser();
        this._automata = new MultiAutomata();

        for (let i = 0, l = patterns.length; i < l; ++i) {
            this._addPattern(patterns[i].name, patterns[i].pattern);
        }
    }

    scan(input) {
        return this._automata.scan(input);
    }

    _addPattern(name, pattern) {
        this._automata.addDfa(name, Dfa.minimize(Dfa.fromNfa(this._parser.parse(pattern))));
    }
}

module.exports = MultiRegexp;
