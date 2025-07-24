const myChart = echarts.init(document.getElementById("container"), "dark");
const smallChart = echarts.init(document.getElementById('small_container'), "dark");
var graph_data_json, separated_json, merged_json;

// Initialize file paths from the HTML script or set to null
separated_json = window.initialSeparateJsonPath || null;
merged_json = window.initialMergeJsonPath || null;

var chart_option = {
    title: {
        text: "Pathway connections",
    },
    toolbox: {
        show: true,
        feature: {
            myTool1: {
                show: true,
                title: 'upload json data',
                icon: 'path://M512 0c-282.77 0-512 229.23-512 512s229.23 512 512 512 512-229.23 512-512-229.23-512-512-512zM768 576h-256v192h-128v-192h-256l384-384 384 384z',
                onclick: function () {
                    var input = document.createElement('input');
                    input.type = 'file';
                    input.onchange = function () {
                        console.log("load " + input.files[0].name)
                        make_graph(input)
                    };
                    input.click();
                }
            },
            dataView: { readOnly: true },
            saveAsImage: {}
        }
    },
    tooltip: {
        formatter: function (params) {
            return `${params.name}: ${params.value}<br>${'proportion' in params.data ? params.data.proportion : ''}`
        }
    },
};




// *******************************
// ******** custom functions *****
// *******************************
/**
 * when clicking on the edge of the mergeNode graph, 
 * display a smaller graph for both end nodes
 * @param {*} json_data 
 * @param {*} dom the small popup window for displaying the chart
 */
const update_small_chart = (json_data) => {
    const option = {
        tooltip: {
            formatter: function (params) {
                let display_name;
                if (params.name.includes(" > ")) {
                    display_name = params.name.split(" > ").join("<---> <br/>")
                } else {
                    display_name = params.name
                }
                return `${display_name}:<br> ${params.value} overlap genes`
            }
        },
        legend: { data: json_data.categories.map(function (a) { return a.name; }), bottom: "5%" },
        series: [
            {
                type: 'graph',
                layout: 'force',
                draggable: true,
                roam: true,
                data: json_data.nodes,
                links: json_data.links,
                categories: json_data.categories
            }
        ]
    };
    smallChart.setOption(option)
}

/**
 * update the dataList inputbox DOM for user filtering by pathway names
 */
const update_dataList_input = () => {
    const dataList = document.getElementById("pathway_names")
    graph_data_json.nodes.map(o => {
        const newOption = document.createElement('option');
        newOption.value = o['name'];
        dataList.appendChild(newOption);
    })
}

/**
 * create the myChart
 * @param {*} json_path_or_data either a path string, data object, or a DOM created by 
 *                              `document.createElement('input')` in js `input.onchange`
 */
var make_graph = async (json_path_or_data) => {
    // Check for null or undefined input
    if (!json_path_or_data) {
        console.warn('No data provided to make_graph');
        return;
    }

    // Clear any existing chart state first
    myChart.clear();

    // read the json file or use provided data
    if (typeof json_path_or_data === 'object' && !json_path_or_data.files) {
        graph_data_json = json_path_or_data;
    } else if (json_path_or_data instanceof HTMLInputElement) {
        const file = json_path_or_data.files[0];
        graph_data_json = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(JSON.parse(reader.result));
            };
            reader.readAsText(file);
        });
    } else if (typeof json_path_or_data === 'string') {
        try {
            const response = await fetch(json_path_or_data);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            graph_data_json = await response.json();
        } catch (error) {
            console.warn(`Failed to load JSON file: ${json_path_or_data}`, error);
            return;
        }
    } else {
        console.warn('Invalid input for make_graph');
        return;
    }

    // Reset chart_option to base configuration
    chart_option = {
        title: {
            text: "Pathway connections",
        },
        toolbox: {
            show: true,
            feature: {
                myTool1: {
                    show: true,
                    title: 'upload json data',
                    icon: 'path://M512 0c-282.77 0-512 229.23-512 512s229.23 512 512 512 512-229.23 512-512-229.23-512-512-512zM768 576h-256v192h-128v-192h-256l384-384 384 384z',
                    onclick: function () {
                        var input = document.createElement('input');
                        input.type = 'file';
                        input.onchange = function () {
                            console.log("load " + input.files[0].name)
                            make_graph(input)
                        };
                        input.click();
                    }
                },
                dataView: { readOnly: true },
                saveAsImage: {}
            }
        },
        tooltip: {
            formatter: function (params) {
                return `${params.name}: ${params.value}<br>${'proportion' in params.data ? params.data.proportion : ''}`
            }
        },
    };

    // set new title & legend
    if (graph_data_json.hasOwnProperty('title')) {
        chart_option['title'] = {
            text: graph_data_json.title,
        }
    }
    chart_option['legend'] = {
        data: graph_data_json.categories.map((a) => {
            return a.name;
        }),
        bottom: "3%",
        left: "1%"
    }

    // data series
    chart_option['series'] = [
        {
            type: "graph",
            layout: 'force',
            draggable: true,
            categories: graph_data_json.categories,
            nodes: graph_data_json.nodes,
            links: graph_data_json.links.filter(l => l.value > threshold_slider.value),
            emphasis: {
                focus: 'adjacency',
                label: {
                    position: 'right',
                    show: true
                },
                edgeLabel: {
                    show: true,
                    formatter: "{c} common genes"
                }
            },
            roam: true,
            lineStyle: {
                width: 0.5,
                curveness: 0.3,
                opacity: 0.7
            }
        },
    ]

    // update graph
    myChart.setOption(chart_option);

    // update the dash board
    update_dashboard()

    // update the filter input datalist
    update_dataList_input()
}

const update_edge_threshold = (shared_gene_threshold) => {
    myChart.clear();
    myChart.showLoading();

    chart_option['series'][0]['links'] = graph_data_json.links.filter(l => l.value > shared_gene_threshold)

    myChart.setOption(chart_option);
    myChart.hideLoading();
    update_dashboard()
}

make_graph(merged_json)


// *******************************
// ***** graph properties ********
// *******************************

const update_dashboard = async function () {
    const graph_node_links = myChart.getOption().series[0];
    const top_betweenness = get_top_betweenness(graph_node_links, 10);
    const top_degree = get_top_nodeDegrees(graph_node_links, 10);
    let dashboard_content = document.querySelector(".graph-propert-content");
    dashboard_content.innerHTML = "";

    /**
     * create table from input object
     * @param {*} obj a dictionary where the key is the pathway name and the value is the centrality value
     * @param {*} value_str "centrality" or "degree"
     * @returns the table DOM element
     */
    const createTable = function (obj, value_str = "centrality") {
        const keys = Object.keys(obj);
        const table = document.createElement("table");
        const head_row = document.createElement("tr");
        const left_cell = document.createElement("th");
        left_cell.textContent = "pathway";
        head_row.appendChild(left_cell);
        const right_cell = document.createElement("th");
        right_cell.textContent = value_str;
        head_row.appendChild(right_cell);
        table.appendChild(head_row);

        keys.forEach(key => {
            const row = document.createElement("tr");
            const headerCell = document.createElement("td");
            headerCell.textContent = key;
            row.appendChild(headerCell);

            const dataCell = document.createElement("td");
            dataCell.textContent = obj[key];
            row.appendChild(dataCell);

            table.appendChild(row);
        });

        return table;
    }

    const between_header = document.createElement("h5");
    between_header.textContent = "Top pathways in betweenness centrality (# of times a node acts as a bridge along the shortest path between two other nodes)";
    dashboard_content.appendChild(between_header);
    dashboard_content.appendChild(createTable(top_betweenness));
    const degree_header = document.createElement("h5");
    degree_header.textContent = "Top pathways in degree (# of connections/links)";
    dashboard_content.appendChild(degree_header);
    dashboard_content.appendChild(createTable(top_degree, "degree"));

    // create csv file and add as a link
    if (separated_json) {
        try {
            let json_data;
            if (window.dynamicSeparateSets) {
                json_data = window.dynamicSeparateSets;
            } else {
                const response = await fetch(separated_json);
                if (response.ok) {
                    json_data = await response.json();
                }
            }

            if (json_data) {
                const find_shared_genes = (pathway, score, table_attr) => {
                    // find shared genes connecting to this pathway
                    let new_links = json_data.links.filter(o => o['source'].includes(pathway) | o['target'].includes(pathway))
                    // merge each node's records into a single array
                    let allRecords = new_links.reduce((accumulator, current) => {
                        return accumulator.concat(current.records);
                    }, []);
                    // remove duplicates
                    let uniqueRecords = [...new Set(allRecords)];
                    return `${table_attr},${pathway},${score},"${uniqueRecords.join(',')}"`;
                };
                const mappedArray = [...Object.entries(top_betweenness).map(([pathway, score]) => find_shared_genes(pathway, score, "betweenness")),
                ...Object.entries(top_degree).map(([pathway, score]) => find_shared_genes(pathway, score, "degree"))]

                const csvContent = "attribute,pathway,score,shared_genes\n" + mappedArray.join("\n");

                const downloadBtn = document.querySelector(".download-btn");
                const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
                downloadBtn.setAttribute('href', encodedUri);
                downloadBtn.setAttribute('download', `centrality_degree_important_pathways.csv`);
            }
        } catch (error) {
            console.warn('Failed to load separated JSON for CSV generation:', error);
        }
    }
}

// Initialize the graph - simplified for standalone mode
setTimeout(() => {
    if (window.initialMergeJsonPath && window.initialSeparateJsonPath) {
        // Only try to load if both files are predefined (user has manually set paths)
        merged_json = window.initialMergeJsonPath;
        separated_json = window.initialSeparateJsonPath;
        console.log('Loading predefined files:', { merged_json, separated_json });
        // Try to load, but don't fail if files don't exist
        loadJsonFile(merged_json).then(data => {
            if (data) {
                make_graph(data);
            } else {
                showNoDataMessage();
            }
        });
    } else {
        console.log('Standalone mode - waiting for file upload');
        showNoDataMessage();
    }
}, 500);

// Helper function to load JSON files with error handling
async function loadJsonFile(path) {
    try {
        const response = await fetch(path);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.log('Could not load JSON file:', path);
    }
    return null;
}

// Helper function to show no data message
function showNoDataMessage() {
    myChart.setOption({
        title: {
            text: "No pathway data available",
            subtext: "Upload CSV or JSON files to generate pathway network",
            left: 'center',
            top: 'center'
        },
        graphic: {
            elements: [{
                type: 'text',
                left: 'center',
                top: 'middle',
                style: {
                    text: '📁 Standalone Mode\n\nUpload CSV files to process pathway enrichment data\nor upload existing JSON files to load saved networks',
                    fontSize: 16,
                    fill: '#999',
                    textAlign: 'center'
                }
            }]
        }
    });
}

// *******************************
// ********** listeners **********
// *******************************

const threshold_slider = document.querySelector('#threshold_slider');
threshold_slider.addEventListener('input', () => {
    var threshold = threshold_slider.value;
    document.querySelector("label[for='threshold_slider'] span").innerText = threshold;
    update_edge_threshold(threshold)
});

// toggle between the two json files
document.getElementById("nodeMerge_switch").addEventListener("change", (e) => {
    if (e.target.checked) {
        const mergeData = window.dynamicMergePathway || merged_json;
        if (mergeData) {
            make_graph(mergeData);
        } else {
            console.warn('No merge pathway data available');
            e.target.checked = false; // Reset the switch
        }
    } else {
        const separateData = window.dynamicSeparateSets || separated_json;
        if (separateData) {
            make_graph(separateData);
        } else {
            console.warn('No separate sets data available');
            e.target.checked = true; // Reset the switch
        }
    }
})

// hide the popup panel when clicking outside of it
document.getElementById("panel").addEventListener('click', function (event) {
    if (!document.querySelector('.panel-content').contains(event.target)) {
        document.getElementById("panel").classList.add("hidden");
    }
});

// click on the node/edge to show another detail graph
myChart.on('click', async (params) => {
    // https://echarts.apache.org/handbook/en/concepts/event
    if (params.dataType === 'node') {
        document.getElementById("panel").classList.remove("hidden");

        let json_data;
        if (window.dynamicSeparateSets) {
            json_data = window.dynamicSeparateSets;
        } else if (separated_json) {
            json_data = await loadJsonFile(separated_json);
            if (!json_data) {
                console.warn('No separated sets data available');
                return;
            }
        } else {
            console.warn('No separated sets data available');
            return;
        }
        
        let new_links = json_data.links.filter(o => o['source'].includes(params.name) | o['target'].includes(params.name))
        let filtered_json = {
            categories: json_data.categories,
            links: new_links,
            nodes: json_data.nodes.filter(o => new_links.some(n => o['name'].includes(n['source']) | o['name'].includes(n['target']))),
        }
        update_small_chart(filtered_json)
        // update title and subtitle
        document.querySelector(".panel-content h3").innerText = params.name;
        let allRecords = new_links.reduce((accumulator, current) => {
            return accumulator.concat(current.records);
        }, []);

        let uniqueRecords = [...new Set(allRecords)];
        if (uniqueRecords.length > 14) {
            const paragraph_lines = [];
            for (let i = 0; i < uniqueRecords.length; i += 14) paragraph_lines.push(uniqueRecords.slice(i, i + 14));
            uniqueRecords = paragraph_lines.map((paragraph_line) => paragraph_line.join(", ")).join("<br/>");
        }
        document.querySelector(".panel-content p").innerHTML = `All shared genes connect to ${params.name} are:<br/>${uniqueRecords}`
    }
    if (params.dataType === 'edge') {
        document.getElementById("panel").classList.remove("hidden");
        
        let json_data;
        if (window.dynamicSeparateSets) {
            json_data = window.dynamicSeparateSets;
        } else if (separated_json) {
            json_data = await loadJsonFile(separated_json);
            if (!json_data) {
                console.warn('No separated sets data available');
                return;
            }
        } else {
            console.warn('No separated sets data available');
            return;
        }
        
        const end_nodes = params.name.split(" > ");
        let filtered_json = {
            categories: json_data.categories,
            nodes: json_data.nodes.filter(o => end_nodes.some((n) => o['name'].includes(n))),
            links: json_data.links.filter(o => end_nodes.every((n) => o['source'].includes(n) | o['target'].includes(n)))
        }
        update_small_chart(filtered_json)
        document.querySelector(".panel-content h3").innerText = `${params.name.replace(">", "<===>")}(${params.value} common genes)`

        let uniqueRecords = params.data.records;
        if (uniqueRecords.length > 14) {
            const paragraph_lines = [];
            for (let i = 0; i < uniqueRecords.length; i += 14) paragraph_lines.push(uniqueRecords.slice(i, i + 14));
            uniqueRecords = paragraph_lines.map((paragraph_line) => paragraph_line.join(", ")).join("<br/>");
        }
        document.querySelector(".panel-content p").innerHTML = `Shared genes are:<br/>${uniqueRecords}`

    }
});

window.addEventListener('resize', function () {
    myChart.resize();
});

// Pathway filter search with highlight functionality
document.getElementById('filter_pathway').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const searchTerm = this.value.trim();
        
        if (!searchTerm) {
            // Clear any existing highlights
            myChart.dispatchAction({
                type: 'downplay',
                seriesIndex: 0
            });
            return;
        }
        
        // Find matching node in current graph data
        if (graph_data_json && graph_data_json.nodes) {
            const matchingNode = graph_data_json.nodes.find(node => 
                node.name === searchTerm || 
                node.name.toLowerCase() === searchTerm.toLowerCase()
            );
            
            if (matchingNode) {
                // Clear any existing highlights first
                myChart.dispatchAction({
                    type: 'downplay',
                    seriesIndex: 0
                });
                
                // Highlight the matching node and its connections
                myChart.dispatchAction({
                    type: 'highlight',
                    seriesIndex: 0,
                    name: matchingNode.name
                });
                
                // Visual feedback - temporarily change input border color to green
                this.style.borderColor = '#28a745';
                this.style.boxShadow = '0 0 5px rgba(40, 167, 69, 0.5)';
                
                setTimeout(() => {
                    this.style.borderColor = '';
                    this.style.boxShadow = '';
                }, 2000);
                
                console.log(`Highlighted pathway: ${matchingNode.name}`);
            } else {
                // Visual feedback - temporarily change input border color to red
                this.style.borderColor = '#dc3545';
                this.style.boxShadow = '0 0 5px rgba(220, 53, 69, 0.5)';
                
                setTimeout(() => {
                    this.style.borderColor = '';
                    this.style.boxShadow = '';
                }, 2000);
                
                console.log(`Pathway not found: ${searchTerm}`);
            }
        }
    }
});

// Clear highlight when input is cleared
document.getElementById('filter_pathway').addEventListener('input', function() {
    if (!this.value.trim()) {
        // Clear any existing highlights
        myChart.dispatchAction({
            type: 'downplay',
            seriesIndex: 0
        });
    }
});

// CSV Processing Functions (extracted from csv_node_link.js)
const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

function parseCSVLine(line) {
    // Parses a CSV line, handling quoted fields with commas
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

function parseCSVFiles(files) {
    return Promise.all(Array.from(files).map(file =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                const data = [];
                
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim()) {
                        const values = parseCSVLine(lines[i]);
                        const row = {};
                        headers.forEach((header, index) => {
                            let value = values[index] ? values[index].trim() : '';
                            // Special handling for overlap_genes field
                            if (header === 'overlap_genes') {
                                if (value.startsWith('[') && value.endsWith(']')) {
                                    try {
                                        value = JSON.parse(value.replace(/'/g, '"'));
                                    } catch {
                                        value = value.slice(1, -1).split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                                    }
                                } else if (value.includes(',')) {
                                    value = value.split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                                } else if (value) {
                                    value = [value.replace(/['"]/g, '').replace(/^\[+|\]+$/g, '')];
                                } else {
                                    value = [];
                                }
                            }
                            row[header] = value;
                        });
                        data.push(row);
                    }
                }
                resolve(data);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        })
    ));
}

function nodeLinkSeparateSets(allTables, pairwiseCompares) {
    const nodes = [];
    const links = [];
    allTables.forEach((table, tableIdx) => {
        table.forEach((row, rowIdx) => {
            const pathway = row.term;
            let genes = row.overlap_genes;
            
            // Ensure genes is always an array
            if (!Array.isArray(genes)) {
                if (typeof genes === 'string') {
                    if (genes.startsWith('[') && genes.endsWith(']')) {
                        try {
                            genes = JSON.parse(genes.replace(/'/g, '"'));
                        } catch {
                            genes = genes.slice(1, -1).split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                        }
                    } else if (genes.includes(',')) {
                        genes = genes.split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                    } else if (genes) {
                        genes = [genes.replace(/['"]/g, '').replace(/^\[+|\]+$/g, '')];
                    } else {
                        genes = [];
                    }
                } else {
                    genes = [];
                }
            }
            
            nodes.push({
                name: `${pathway}(${pairwiseCompares[tableIdx]})`,
                value: genes.length,
                category: pairwiseCompares[tableIdx]
            });
            
            // within table
            for (let otherIdx = rowIdx + 1; otherIdx < table.length; otherIdx++) {
                const other = table[otherIdx];
                let otherGenes = other.overlap_genes;
                
                // Ensure otherGenes is always an array
                if (!Array.isArray(otherGenes)) {
                    if (typeof otherGenes === 'string') {
                        if (otherGenes.startsWith('[') && otherGenes.endsWith(']')) {
                            try {
                                otherGenes = JSON.parse(otherGenes.replace(/'/g, '"'));
                            } catch {
                                otherGenes = otherGenes.slice(1, -1).split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                            }
                        } else if (otherGenes.includes(',')) {
                            otherGenes = otherGenes.split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                        } else if (otherGenes) {
                            otherGenes = [otherGenes.replace(/['"]/g, '').replace(/^\[+|\]+$/g, '')];
                        } else {
                            otherGenes = [];
                        }
                    } else {
                        otherGenes = [];
                    }
                }
                
                if (pathway !== other.term) {
                    const shared = genes.filter(g => otherGenes.includes(g));
                    if (shared.length > 0) {
                        links.push({
                            source: `${pathway}(${pairwiseCompares[tableIdx]})`,
                            target: `${other.term}(${pairwiseCompares[tableIdx]})`,
                            value: shared.length,
                            records: shared
                        });
                    }
                }
            }
            // cross table
            for (let j = tableIdx + 1; j < allTables.length; j++) {
                allTables[j].forEach(other => {
                    let otherGenes = other.overlap_genes;
                    
                    // Ensure otherGenes is always an array
                    if (!Array.isArray(otherGenes)) {
                        if (typeof otherGenes === 'string') {
                            if (otherGenes.startsWith('[') && otherGenes.endsWith(']')) {
                                try {
                                    otherGenes = JSON.parse(otherGenes.replace(/'/g, '"'));
                                } catch {
                                    otherGenes = otherGenes.slice(1, -1).split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                                }
                            } else if (otherGenes.includes(',')) {
                                otherGenes = otherGenes.split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                            } else if (otherGenes) {
                                otherGenes = [otherGenes.replace(/['"]/g, '').replace(/^\[+|\]+$/g, '')];
                            } else {
                                otherGenes = [];
                            }
                        } else {
                            otherGenes = [];
                        }
                    }
                    
                    const shared = genes.filter(g => otherGenes.includes(g));
                    if (shared.length > 0) {
                        links.push({
                            source: `${pathway}(${pairwiseCompares[tableIdx]})`,
                            target: `${other.term}(${pairwiseCompares[j]})`,
                            value: shared.length,
                            records: shared
                        });
                    }
                });
            }
        });
    });
    
    const categories = pairwiseCompares.map((name, index) => ({
        name: name,
        itemStyle: { color: colors[index] }
    }));
    
    return { nodes, links, categories };
}

function nodeLinkMergePathways(allTables, pairwiseCompares) {
    const nameColor = Object.fromEntries(pairwiseCompares.map((k, i) => [k, colors[i]]));
    // merge pathways with the same name across all tables
    const pathwayMap = {};
    allTables.forEach((table, tableIdx) => {
        table.forEach(row => {
            const term = row.term;
            let genes = row.overlap_genes;
            
            // Ensure genes is always an array
            if (!Array.isArray(genes)) {
                if (typeof genes === 'string') {
                    if (genes.startsWith('[') && genes.endsWith(']')) {
                        try {
                            genes = JSON.parse(genes.replace(/'/g, '"'));
                        } catch {
                            genes = genes.slice(1, -1).split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                        }
                    } else if (genes.includes(',')) {
                        genes = genes.split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                    } else if (genes) {
                        genes = [genes.replace(/['"]/g, '').replace(/^\[+|\]+$/g, '')];
                    } else {
                        genes = [];
                    }
                } else {
                    genes = [];
                }
            }
            
            const source = pairwiseCompares[tableIdx];
            const geneLen = genes.length;
            if (!pathwayMap[term]) {
                pathwayMap[term] = { overlap_genes: new Set(), source: [], source_geneLen: [] };
            }
            genes.forEach(g => pathwayMap[term].overlap_genes.add(g.replace(/^\[+|\]+$/g, '')));
            pathwayMap[term].source.push(source);
            pathwayMap[term].source_geneLen.push(geneLen);
        });
    });
    const merged = Object.entries(pathwayMap).map(([term, obj]) => {
        const overlapGenes = Array.from(obj.overlap_genes);
        const geneLen = overlapGenes.length;
        const proportion = obj.source_geneLen.map(x => +(x / geneLen).toFixed(4));
        return { term, overlap_genes: overlapGenes, source: obj.source, proportion, gene_len: geneLen };
    });

    const nodes = merged.map(row => {
        let colorStops = [];
        let offset = 0;
        let printProps = [];
        const total = row.proportion.reduce((a, b) => a + b, 0);
        row.source.forEach((src, i) => {
            colorStops.push({ offset, color: nameColor[src] });
            let p = +(row.proportion[i] / total).toFixed(3);
            offset += p;
            if (offset > 1.0) offset = 1.0;
            colorStops.push({ offset, color: nameColor[src] });
            printProps.push(`${src}: ${(p * 100).toFixed(2)}%`);
        });
        let category = row.source.length === 1 ? row.source[0] : 'mix';
        return {
            name: row.term,
            value: row.gene_len,
            category,
            itemStyle: {
                color: {
                    type: "linear",
                    colorStops
                }
            },
            proportion: printProps.join('<br>') || `${row.source[0]} 100%`
        };
    });

    const links = [];
    for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
            if (merged[i].term !== merged[j].term) {
                const shared = merged[i].overlap_genes.filter(g => merged[j].overlap_genes.includes(g));
                if (shared.length > 0) {
                    links.push({
                        source: merged[i].term,
                        target: merged[j].term,
                        value: shared.length,
                        records: shared
                    });
                }
            }
        }
    }
    
    const categories = pairwiseCompares.map((name, index) => ({
        name: name,
        itemStyle: { color: colors[index] }
    }));
    categories.push({ name: 'mix', itemStyle: { color: '#999' } });
    
    return { nodes, links, categories };
}

// CSV Upload Handler
async function handleFiles(files, pairwiseCompares) {
    const allTables = await parseCSVFiles(files);
    
    // Additional cleanup: ensure all overlap_genes are arrays
    allTables.forEach(table => {
        table.forEach(row => {
            if (!Array.isArray(row.overlap_genes)) {
                let genes = row.overlap_genes;
                if (typeof genes === 'string') {
                    if (genes.startsWith('[') && genes.endsWith(']')) {
                        try {
                            row.overlap_genes = JSON.parse(genes.replace(/'/g, '"'));
                        } catch {
                            row.overlap_genes = genes.slice(1, -1).split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                        }
                    } else if (genes.includes(',')) {
                        row.overlap_genes = genes.split(',').map(g => g.trim().replace(/['"]/g, '').replace(/^\[+|\]+$/g, ''));
                    } else if (genes) {
                        row.overlap_genes = [genes.replace(/['"]/g, '').replace(/^\[+|\]+$/g, '')];
                    } else {
                        row.overlap_genes = [];
                    }
                } else {
                    row.overlap_genes = [];
                }
            }
        });
    });
    
    const separateSets = nodeLinkSeparateSets(allTables, pairwiseCompares);
    const mergePathway = nodeLinkMergePathways(allTables, pairwiseCompares);
    
    // Ensure mix category has proper styling in categories
    if (mergePathway.categories) {
        const mixCategory = mergePathway.categories.find(cat => cat.name === 'mix');
        if (mixCategory) {
            mixCategory.itemStyle = {
                color: {
                    type: "linear",
                    colorStops: [
                        {
                            offset: 0,
                            color: "#5470c6"
                        },
                        {
                            offset: 0.255,
                            color: "#5470c6"
                        },
                        {
                            offset: 0.255,
                            color: "#91cc75"
                        },
                        {
                            offset: 0.51,
                            color: "#91cc75"
                        },
                        {
                            offset: 0.51,
                            color: "#fac858"
                        },
                        {
                            offset: 1.0,
                            color: "#fac858"
                        }
                    ]
                }
            };
        }
    }
    
    return { separateSets, mergePathway };
}

// Function to extract comparison name from filename
function extractComparisonName(filename) {
    // Remove file extension
    let name = filename.replace(/\.(csv|CSV)$/, '');
    
    // Remove common suffixes
    const suffixesToRemove = [
        '_pathway_enrichment',
        '_enrichment',
        '_pathways',
        '_GSEA',
        '_results'
    ];
    
    suffixesToRemove.forEach(suffix => {
        name = name.replace(new RegExp(suffix + '$', 'i'), '');
    });
    
    // Clean up any remaining underscores or hyphens at the end
    name = name.replace(/[_-]+$/, '');
    
    return name;
}

// CSV Upload Event Listeners
document.getElementById('csvInput').addEventListener('change', function() {
    const files = this.files;
    const preview = document.getElementById('file-preview');
    
    if (files.length > 0) {
        const fileNames = Array.from(files).map((file, index) => {
            const comparisonName = extractComparisonName(file.name);
            return `${index + 1}. ${file.name} → ${comparisonName}`;
        });
        preview.innerHTML = `Files selected:<br>${fileNames.join('<br>')}`;
    } else {
        preview.innerHTML = '';
    }
});

document.getElementById('process-csv').addEventListener('click', async () => {
    const fileInput = document.getElementById('csvInput');
    if (fileInput.files.length === 0) {
        alert('Please select CSV files');
        return;
    }
    try {
        showLoadingOverlay('Processing CSV files...');
        myChart.showLoading('Loading CSV data...');
        // Extract comparison names from filenames
        const comparisonNames = Array.from(fileInput.files).map(file => 
            extractComparisonName(file.name)
        );
        
        console.log('Detected comparison names:', comparisonNames);
        
        const result = await handleFiles(fileInput.files, comparisonNames);
        
        // Store dynamic data globally
        window.dynamicSeparateSets = result.separateSets;
        window.dynamicMergePathway = result.mergePathway;
        
        // Update the current data paths
        separated_json = 'dynamic';
        merged_json = 'dynamic';
        
        // Enable download buttons
        document.getElementById('download-separate-json').disabled = false;
        document.getElementById('download-merge-json').disabled = false;
        
        // Hide loading and load the merged pathway graph by default
        myChart.hideLoading();
        hideLoadingOverlay();
        make_graph(result.mergePathway);
        
        alert(`CSV files processed successfully!\nDetected comparisons: ${comparisonNames.join(', ')}`);
    } catch (error) {
        myChart.hideLoading();
        hideLoadingOverlay();
        console.error('Error processing CSV files:', error);
        alert('Error processing CSV files: ' + error.message);
    }
});

// Download processed separate sets JSON
document.getElementById('download-separate-json').addEventListener('click', function() {
    if (window.dynamicSeparateSets) {
        const dataStr = JSON.stringify(window.dynamicSeparateSets, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'separate_sets_node_link.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});

// Download processed merged pathway JSON
document.getElementById('download-merge-json').addEventListener('click', function() {
    if (window.dynamicMergePathway) {
        const dataStr = JSON.stringify(window.dynamicMergePathway, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merged_pathway_node_link.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});

// JSON Upload Event Listeners
document.getElementById('jsonInput').addEventListener('change', function() {
    const files = this.files;
    const preview = document.getElementById('json-file-preview');
    
    if (files.length > 0) {
        const fileNames = Array.from(files).map((file, index) => {
            const type = file.name.includes('separate') || file.name.includes('Sets') ? 'Separate Sets' : 
                        file.name.includes('merge') || file.name.includes('Pathway') ? 'Merge Pathway' : 'Unknown';
            return `${index + 1}. ${file.name} (${type})`;
        });
        preview.innerHTML = `Files selected:<br>${fileNames.join('<br>')}`;
    } else {
        preview.innerHTML = '';
    }
});

document.getElementById('process-json').addEventListener('click', async () => {
    const fileInput = document.getElementById('jsonInput');
    if (fileInput.files.length === 0) {
        alert('Please select JSON files');
        return;
    }
    try {
        showLoadingOverlay('Processing JSON files...');
        myChart.showLoading('Loading JSON files...');
        
        const files = Array.from(fileInput.files);
        let separateData = null;
        let mergeData = null;
        
        // Process each JSON file
        for (const file of files) {
            const data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        resolve(JSON.parse(reader.result));
                    } catch (error) {
                        console.error('Error parsing JSON file:', file.name, error);
                        resolve(null);
                    }
                };
                reader.readAsText(file);
            });
            
            if (data) {
                // Determine file type based on filename or structure
                if (file.name.includes('separate') || file.name.includes('Sets') || 
                    (data.nodes && data.nodes.some(n => n.name.includes('(')))) {
                    separateData = data;
                    console.log('Loaded separate sets data from:', file.name);
                } else if (file.name.includes('merge') || file.name.includes('Pathway') ||
                          (data.nodes && data.nodes.some(n => n.proportion))) {
                    mergeData = data;
                    console.log('Loaded merge pathway data from:', file.name);
                }
            }
        }
        
        // Store the loaded data
        if (separateData) {
            window.dynamicSeparateSets = separateData;
            separated_json = 'dynamic';
        }
        if (mergeData) {
            window.dynamicMergePathway = mergeData;
            merged_json = 'dynamic';
        }
        
        myChart.hideLoading();
        hideLoadingOverlay();
        
        // Load the appropriate graph
        if (mergeData) {
            make_graph(mergeData);
            alert(`JSON files loaded successfully!\nLoaded: ${mergeData ? 'Merge Pathway' : ''}${separateData ? (mergeData ? ' + Separate Sets' : 'Separate Sets') : ''}`);
        } else if (separateData) {
            make_graph(separateData);
            alert('JSON files loaded successfully!\nLoaded: Separate Sets');
        } else {
            alert('No valid pathway JSON files found. Please check your file format.');
        }
        
    } catch (error) {
        myChart.hideLoading();
        hideLoadingOverlay();
        console.error('Error processing JSON files:', error);
        alert('Error processing JSON files: ' + error.message);
    }
});

// Utility: Show/hide loading overlay
function showLoadingOverlay(text = "Processing files...") {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.querySelector('.loading-text').textContent = text;
    }
}
function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// Focus management for modal panel
document.getElementById("panel").addEventListener('transitionend', function () {
    if (!this.classList.contains('hidden')) {
        const closeBtn = document.querySelector('.close-panel-btn');
        if (closeBtn) closeBtn.focus();
    }
});