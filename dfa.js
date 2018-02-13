'use strict';

const Automata = require('./automata');
const Node = require('./node');

class Dfa extends Automata {
    constructor(start, accepts) {
        super(start, accepts);
    }

    static fromNfa(automata) {
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
                    });

                    if (pushFlag) {
                        conversionTable[id].transitions[transition.key].push({
                            target: transition.target.getId()
                        });
                    }
                });
            }

            Object.keys(conversionTable[id].transitions).forEach((key) => {
                let newRow = [];
                let checkId = '';
                conversionTable[id].transitions[key].sort((a, b) => {
                    return a.target - b.target;
                });
                for (let i = 0; i < conversionTable[id].transitions[key].length; ++i) {
                    checkId += conversionTable[id].transitions[key][i].target;
                    if (i !== conversionTable[id].transitions[key].length - 1) {
                        checkId += ',';
                    }
                    newRow.push(referenceTable[conversionTable[id].transitions[key][i].target]);
                }
                conversionTable[id].transitions[key] = [{
                    target: checkId
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
                buildTable[finalNodeId].addTransition(key, transitionNode);
            });
        });

        return new Dfa(rootNode, accepts);
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
                    let rightId;
                    if (!leftNode.hasTransition(transitionKey)) {
                        leftId = startId;
                    } else {
                        let transition = leftNode.getTransitions(transitionKey)[0];
                        leftId = transition.target._id;
                    }

                    if (!rightNode.hasTransition(transitionKey)) {
                        rightId = startId;
                    } else {
                        let transition = rightNode.getTransitions(transitionKey)[0];
                        rightId = transition.target._id;
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
                    let result = pairTable[transitionSplit.join(',')];
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

            // TODO: evaluate whether this is really needed. Basically doesn't let start node get paired up with anyone.
            /*
            if (leftId == automata._start.getId() || rightId == automata._start.getId()) {
                continue;
            }
            */

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

                    node.addTransition(transitionKey, buildTable[groupTable[referenceTable[unit].getTransitions(transitionKey)[0].target._id]]);
                });
            });
        });

        return new Dfa(buildTable[groupTable[automata._start._id.toString()].join(',')], acceptNodes);
    }
}

module.exports = Dfa;
