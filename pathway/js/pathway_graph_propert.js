/**
 * 
 * @param {*} graph {nodes: [{name}], links: [], nodeMap: [a map for faster lookup]}
 * @return {Object} a dictionary of betweenness
 */
function computeBetweenness(graph) {
    const betweenness = {};

    // initialize betweenness scores
    for (const node of graph.nodes) {
        betweenness[node.name] = 0;
    }

    // construct edges information
    for (const node of graph.nodes) {
        node.edges = {};

        for (const edge of graph.links) {
            if (edge.source === node.name) {
                node.edges[edge.target] = edge.weight;
            } else if (edge.target === node.name) {
                node.edges[edge.source] = edge.weight;
            }
        }
    }

    for (const node of graph.nodes) {
        // initialize stack and distance array
        const stack = [];
        const distance = {};
        const paths = {};

        for (const n of graph.nodes) {
            distance[n.name] = -1;
            paths[n.name] = [];
        }

        // initialize starting node
        distance[node.name] = 0;
        paths[node.name] = [node.name];
        const queue = [node];

        // BFS search
        while (queue.length > 0) {
            const current = queue.shift();
            stack.push(current);

            for (const [neighborId, weight] of Object.entries(current.edges)) {
                const neighbor = graph.nodeMap.get(neighborId);

                if (distance[neighbor.name] < 0) {
                    queue.push(neighbor);
                    distance[neighbor.name] = distance[current.name] + 1;
                }

                if (distance[neighbor.name] === distance[current.name] + 1) {
                    paths[neighbor.name].push(...paths[current.name], neighbor.name);
                }
            }
        }

        const score = {};
        for (const n of graph.nodes) {
            score[n.name] = 0;
        }

        // get credit values for each node
        while (stack.length > 0) {
            const current = stack.pop();

            for (const path of paths[current.name]) {
                score[path] += 1 / paths[current.name].length;
            }

            if (current.name !== node.name) {
                betweenness[current.name] += score[current.name];
            }
        }
    }

    // normalize scores by dividing by (n-1)(n-2)/2 (where n is the number of nodes)
    const n = graph.nodes.length;
    const normalization = (n - 1) * (n - 2) / 2;

    for (const node of graph.nodes) {
        betweenness[node.name] /= normalization;
    }

    return betweenness;
}


/**
 * Return the top N nodes with the highest betweenness centrality
 * @param {*} chart_data graph data by `mychart.getOption().series[0]`
 * @param {number} topN default = 5, the top N
 * @returns 
 */
const get_top_betweenness = function (chart_data, topN = 5) {
    // populate nodeMap for faster lookup
    chart_data.nodeMap = new Map(chart_data.nodes.map((node) => [node.name, node]));
    // Compute betweenness centrality
    const betweenness = computeBetweenness(chart_data);
    const sortedNodes = Object.keys(betweenness).sort((a, b) => betweenness[b] - betweenness[a]);
    const topNodes = sortedNodes.slice(0, topN);
    const result = {};
    topNodes.forEach(node => {
        result[node] = betweenness[node].toFixed(4);
    });
    return result;
}

/**
 * Return the top N nodes with the highest degrees
 * @param {*} chart_data graph data by `mychart.getOption().series[0]`
 * @param {number} topN default = 5, the top N nodes
 * @returns 
 */
const get_top_nodeDegrees = function (chart_data, topN = 5) {
    const links = chart_data.links;
    const degrees = {};
    links.forEach(link => {
        const source = link.source;
        const target = link.target;
        degrees[source] = degrees[source] ? degrees[source] + 1 : 1;
        degrees[target] = degrees[target] ? degrees[target] + 1 : 1;
    });

    // const topNodes = Object.fromEntries(Object.entries(degrees)
    //     .sort((a, b) => b[1] - a[1])
    //     .slice(0, topN)
    // );
    // return topNodes;

    const all_nodes = Object.entries(degrees)
        .sort((a, b) => b[1] - a[1])
    const topNodes = all_nodes.slice(0, topN);
    if (topNodes.length === 0) {
        return {};
    }
    // if length < topN, threshold = value of the last node
    const threshold = topNodes[topNodes.length - 1][1];
    const result = {};
    all_nodes.forEach(([node, value]) => {
        if (value >= threshold) {
            result[node] = value;
        }
    });
    return result;
}
