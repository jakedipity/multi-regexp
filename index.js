'use strict';

const RegexParser = require('./regex-parser');
const Dfa = require('./dfa');
const MultiAutomata = require('./multi-automata');

let parser = new RegexParser();
let nfa = parser.parse('abc|bc');
let dfa = Dfa.fromNfa(nfa);
let min = Dfa.minimize(dfa);
let multi = new MultiAutomata();
multi.addDfa('test', min);

multi.print();
