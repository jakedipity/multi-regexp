'use strict';

const MultiRegexp = require('./multi-regexp');

let multi = new MultiRegexp([
    {
        name: 'one'
        , pattern: 'ab*'
    }, {
        name: 'two'
        , pattern: 'b+c'
    }
]);
multi._automata.print();
console.log(multi.scan('abbcc'));
