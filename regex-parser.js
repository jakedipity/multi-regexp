'use strict';

/*
 * This is the grammar for the regex parser in a yacc format:
 *
 * Start            : Regex
 *                  ;
 *
 * Regex            : Term '|' Regex                # Alternation
 *                  ; Term
 *
 * Term             : Factor Term                   # Concatenation
 *                  | %empty
 *                  ;
 *
 * Factor           : Base '*'                      # Kleene Star
 *                  | Base '+'                      # 1 or more
 *                  | Base '?'                      # 0 or more
 *                  | Base
 *                  ;
 *
 * Base             : CHAR
 *                  | '\' CHAR                      # Escape reserved characters
 *                  | '(' Regex ')'                 # Change order of operations
 *                  | '[' CharSet ']'               # Character class
 *                  ;
 *
 * CharSet          : CHAR ...
 *                  ;
 */

const Nfa = require('./nfa.js');

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
                    return Nfa.buildUnion(term, this._grammarRegex());
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
                factor = Nfa.buildDisjunction(factor, this._grammarFactor());
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
                return Nfa.buildKleeneStar(base);
            } else if (this._acceptInput('+')) {
                return Nfa.buildExtPlus(base);
            } else if (this._acceptInput('?')) {
                return Nfa.buildExtZeroOrOne(base);
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
                    return Nfa.buildInput(charSet);
                }
            }
        } else {
            this._acceptInput('\\');

            let symbol = this._getInput();
            this._acceptInput();
            return Nfa.buildInput([symbol]);
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

module.exports = RegexParser;
