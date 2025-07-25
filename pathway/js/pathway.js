const myChart = echarts.init(document.getElementById("container"), "dark");
const smallChart = echarts.init(document.getElementById('small_container'), "dark");
var graph_data_json;

var chart_option = {
    title: {
        text: "Pathway connections",
    },
    toolbox: {
        show: true,
        feature: {
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
var make_graph = async (json_data) => {
    // Check for null or undefined input
    if (!json_data) {
        console.warn('No data provided to make_graph');
        return;
    }

    // Clear any existing chart state first
    myChart.clear();

    graph_data_json = json_data;

    // Reset chart_option to base configuration
    chart_option = {
        title: {
            text: "Pathway connections",
        },
        toolbox: {
            show: true,
            feature: {
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

make_graph(window.dynamicMergePathway)


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
    if (window.dynamicSeparateSets) {
        try {
            let json_data = window.dynamicSeparateSets;

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

// Initialize the graph
showNoDataMessage()

// Helper function to show no data message
function showNoDataMessage() {
    myChart.setOption({
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
        const mergeData = window.dynamicMergePathway;
        if (mergeData) {
            make_graph(mergeData);
        } else {
            console.warn('No merge pathway data available');
            e.target.checked = false; // Reset the switch
        }
    } else {
        const separateData = window.dynamicSeparateSets;
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

        let json_data = window.dynamicSeparateSets;
        if (!json_data) {
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

        let json_data = window.dynamicSeparateSets;
        if (!json_data) {
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
document.getElementById('filter_pathway').addEventListener('keydown', function (event) {
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
document.getElementById('filter_pathway').addEventListener('input', function () {
    if (!this.value.trim()) {
        // Clear any existing highlights
        myChart.dispatchAction({
            type: 'downplay',
            seriesIndex: 0
        });
    }
});



// *******************************
// ******** CSV Processing ********
// *******************************

// CSV Processing Functions
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
            reader.onload = function (e) {
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
                            // Accept both overlap_genes and Genes columns
                            if (header === 'overlap_genes') {
                                if (value.startsWith('[') && value.endsWith(']')) {
                                    try {
                                        value = JSON.parse(value.replace(/'/g, '"'));
                                    } catch {
                                        value = value.slice(1, -1).split(',').map(g => g.trim().replace(/['"]/g, '').replace(/\[|\]/g, ''));
                                    }
                                } else if (value.includes(',')) {
                                    value = value.split(',').map(g => g.trim().replace(/['"]/g, '').replace(/\[|\]/g, ''));
                                } else if (value) {
                                    value = [value.replace(/['"]/g, '').replace(/\[|\]/g, '')];
                                } else {
                                    value = [];
                                }
                                row['overlap_genes'] = value;
                            } else if (header === 'Genes') {
                                // Genes column: SCARB2;CD63;PIK3R1
                                if (value) {
                                    value = value.split(';').map(g => g.trim()).filter(Boolean);
                                } else {
                                    value = [];
                                }
                                row['overlap_genes'] = value;
                            } else if (header === 'Term') {
                                row['term'] = value;
                            } else {
                                row[header] = value;
                            }
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

            nodes.push({
                name: `${pathway}(${pairwiseCompares[tableIdx]})`,
                value: genes.length,
                category: pairwiseCompares[tableIdx]
            });

            // within table
            for (let otherIdx = rowIdx + 1; otherIdx < table.length; otherIdx++) {
                const other = table[otherIdx];
                let otherGenes = other.overlap_genes;

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

            const source = pairwiseCompares[tableIdx];
            const geneLen = genes.length;
            if (!pathwayMap[term]) {
                pathwayMap[term] = { overlap_genes: new Set(), source: [], source_geneLen: [] };
            }
            genes.forEach(g => pathwayMap[term].overlap_genes.add(g.replace(/^\[|\]$/g, '')));
            pathwayMap[term].source.push(source);
            pathwayMap[term].source_geneLen.push(geneLen);
        });
    });
    const merged = Object.entries(pathwayMap).map(([term, obj]) => {
        const overlapGenes = Array.from(obj.overlap_genes);
        const geneLen = overlapGenes.length;
        const proportion = obj.source_geneLen.map(x => +(x / geneLen).toFixed(4));
        // Add source_geneLen to each merged node
        return { term, overlap_genes: overlapGenes, source: obj.source, proportion, gene_len: geneLen, source_geneLen: obj.source_geneLen };
    });

    const nodes = merged.map(row => {
        let colorStops = [];
        let offset = 0;
        let printProps = [];
        // Show gene counts per group instead of proportions
        row.source.forEach((src, i) => {
            colorStops.push({ offset, color: nameColor[src] });
            // Use gene count for each group
            let geneCount = row.source_geneLen[i];
            // Estimate offset for color stops (keep as before)
            let p = row.proportion[i];
            offset += p;
            if (offset > 1.0) offset = 1.0;
            colorStops.push({ offset, color: nameColor[src] });
            printProps.push(`${src}: ${geneCount} genes`);
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
            proportion: printProps.join('<br>') || `${row.source[0]}: ${row.source_geneLen[0]} genes`
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
document.getElementById('csvInput').addEventListener('change', function () {
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