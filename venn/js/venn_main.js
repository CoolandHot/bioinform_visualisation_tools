var p_adjust = 0.05, csv_p_adj_str, csv_log2FC_str, csv_gene_str, csv_headers_str


const random4chars = () => {
    return [...Array(4)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
}


/**
 * Reads a file and return 
 * @param {Object} file the value from input[type=file].files[0]
 * @param {Boolean} reverse true/false, indicating whether to flip the log2 fold change
 * @returns {Array} a filtered json whose p.adjust.value < `p_adjust`
 */
function readCSVFile(file, reverse = true) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const csvData = Papa.parse(reader.result, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true
            });

            let records = csvData.data;
            // Check if first column header is empty, assign gene ID header
            if (csvData.meta.fields && csvData.meta.fields.length > 0 && (!csvData.meta.fields[0] || csvData.meta.fields[0].trim() === "")) {
                // Assign the gene ID column header to the first field
                csvData.meta.fields[0] = csv_gene_str;
                // Update all records to use the correct key
                records = records.map(row => {
                    // Find the key with empty string
                    if (row.hasOwnProperty("")) {
                        row[csv_gene_str] = row[""];
                        delete row[""];
                    }
                    return row;
                });
            }

            let interrogate = document.querySelector(".interrogation-group input[type='radio']:checked").value;
            var filteredRecords;
            if (interrogate === "gene-set") {
                if (reverse) {
                    records = records.map(v => {
                        v[csv_log2FC_str] = -parseFloat(v[csv_log2FC_str])
                        return v
                    })
                }
            } else {
                records = records.map(item => {
                    return { ...item, pathway: item.pathway.toLowerCase() };
                })
            }
            filteredRecords = records.filter(record => record[csv_p_adj_str] && record[csv_p_adj_str] < p_adjust);
            resolve(filteredRecords);
        };
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}



// ===========================================================
// ************************** echarts ***********************
// ===========================================================

var d3Container = d3.select("#container");
var vennChart = venn.VennDiagram()
    .width(700)
    .height(600);
var tooltip = d3.select("body")
    .append("div")
    .attr("class", "venntooltip");

/**
 * read the parameter settings from DOM, map all csv contents to the return
 * @returns an array of each {name, value, records}
 */
const map_csv = () => {
    return new Promise((resolve, reject) => {
        let interrogate = document.querySelector(".interrogation-group input[type='radio']:checked").value;
        var myPromises = getInputValues()
            .filter(v => typeof (v['file']) != 'undefined')
            .map(async v => {
                let records = await readCSVFile(v['file'], v['reverse']);
                if (interrogate === "gene-set") {
                    // only reserve the up/down-regulation/whole gene list
                    switch (v['up_regulate']) {
                        case 'up':
                            records = records.filter(record => record[csv_log2FC_str] > 0);
                            break;
                        case 'down':
                            records = records.filter(record => record[csv_log2FC_str] < 0);
                            break;
                        default: // whole gene list
                            break;
                    }
                    // get the remaining gene list
                    let geneList = records.map(record => record[csv_gene_str]);
                    return { "name": `${v['name']}(${v['up_regulate']})`, "value": geneList, "records": records }
                }
                if (interrogate === "pathway") {
                    let pathwayList = records.map(record => record[csv_gene_str]);
                    return { "name": `${v['name']}`, "value": pathwayList, "records": records }
                }
            });
        Promise.all(myPromises).then((results) => {
            resolve(results);
        });
    });

}

// *********************************
// ******* make intersection *******
// *********************************
function intersectList(...arrays) {
    return arrays.reduce((a, b) => a.filter(c => b.includes(c)));
}

/**
 * This function returns an array of all combinations of `m` elements from `arr`.
 * The order of the elements in each combination doesn’t matter.
 * @param {Array} arr - the array.
 * @param {number} m - The number of elements to combine as a group.
 * @returns {Array} An array of dictionary objects. {combination: Array(m), indices: Array(m)}
 *  `combination`, which is an array containing a combination of `m` elements from the input array;
 *  `indices`, which is an array containing the indices of the elements in that combination.
 */

function getCombinations(arr, m) {
    let result = [];
    let combination = Array(m).fill(0);
    let indices = Array(m).fill(0);
    function makeCombinations(arr, m, start, index) {
        if (index === m) {
            result.push({ combination: combination.slice(), indices: indices.slice() });
            return;
        }
        for (let i = start; i <= arr.length - 1 && arr.length - i >= m - index; ++i) {
            combination[index] = arr[i];
            indices[index] = i;
            makeCombinations(arr, m, i + 1, index + 1);
        }
    }
    makeCombinations(arr, m, 0, 0);
    return result;
}

/**
 * This function returns an array of all combinations of intersection.
 * @param {Array} dataset - the data table of records
 * @returns {Array} An array of dictionary objects: 
*/
const compute_intersect = (dataset) => {
    /**
     * construct a result from the dataset
     *  for each combination of sets
     *  
     *   {sets: [name of the sets],
     *    size: length of the intersection,
     *    record_idx: [the index of dataset holding the records],
     *    intersect: [intersect gene names]}
     */

    let result = [];
    // two or more sets for intersections, the records are the intersect gene list, no detailed log2FC nor p.adjust
    for (let i = 1; i < dataset.length; i++) {
        let comb_res = getCombinations(dataset, i + 1)
            .map(v => {
                let intersect_v = intersectList(...v['combination'].map(x => x['value']))
                if (intersect_v.length > 0) {
                    return {
                        sets: v['combination'].map(x => x['name']),
                        size: intersect_v.length,
                        record_idx: v['indices'],
                        intersect: intersect_v
                    }

                }
            })
            .filter(x => typeof x != 'undefined')

        if (comb_res.length > 0) {
            result = result.concat(comb_res)
        }
    }

    /**
     * from the result, map each record index to real records
     *  so that it can be directly used in the tooltips of D3
     * 
     *   {sets: [name of the sets],
     *    size: length of the intersection,
     *    record_idx: [the index of dataset holding the records],
     *    intersect: [intersect gene names],
     *    records: [{table, setName}]}
     */
    result = result.map(v => {
        v['records'] = v['record_idx'].map(i => {
            return {
                table: dataset[i]['records'].filter(o => v['intersect'].includes(o[csv_gene_str])),
                setName: dataset[i]['name']
            }
        })
        return v
    })
    // for one set, only reserve the unique items
    var unique = dataset.map((v, i) => ({
        sets: [v['name']],
        size: v['value'].length,
        record_idx: [i],
        intersect: [],
        records: [{
            setName: v['name'],
            table: v['records'].filter(o => {
                // look for intersection of this set with another set
                let comb_twosets = result.filter(r => r['sets'].length == 2 & r['sets'].includes(v['name']));
                return !comb_twosets.some(r => r['intersect'].includes(o[csv_gene_str]))
            })
        }]
    }))

    result = result.concat(unique)

    return result
}


const getInputValues = () => {
    let results = [];
    document.querySelectorAll(".set-information")
        .forEach(one => {
            let res = {};
            res['file'] = one.querySelector("input[type='file']").files[0];
            res['name'] = one.querySelector("input[type='text']").value;
            res['reverse'] = one.querySelector(".dataFilter-paras input[type='checkbox']").checked;
            res['up_regulate'] = one.querySelector(".dataFilter-paras input[type='radio']:checked").value;
            results.push(res)
        })
    return results
}

const plot_update = (dataset) => {
    document.getElementById("chart-title").innerText = dataset.map(v => v['name']).join(" * ");

    var data = compute_intersect(dataset);
    d3Container.datum(data).call(vennChart);

    // outline of each circle
    d3Container.selectAll("path")
        .style("stroke-opacity", 0)
        .style("stroke", "#fff")
        .style("stroke-width", 2);

    // add listeners to all the groups to display tooltip on mouseover
    d3Container.selectAll("g")
        .on("mouseover", function (d, i) {
            // sort all the areas relative to the current item
            venn.sortAreas(d3Container, d);
            // Display a tooltip with the current size
            tooltip.transition().duration(100).style("opacity", .9);
            tooltip.text(d.size);
            // highlight the current path
            var selection = d3.select(this).transition("tooltip").duration(200);
            selection.select("path")
                .style("stroke-width", 3)
                .style("fill-opacity", d.sets.length == 1 ? .4 : .1)
                .style("stroke-opacity", 1);
        })

        .on('click', (d, i) => {
            // sort all the areas relative to the current item
            venn.sortAreas(d3Container, d);
            // pop up detailed tables
            document.getElementById("panel").classList.remove("hidden");

            /**
             * display the detail table/tables
             * 
             * 1. single set region click: display only one table for unique items
             * 2. intersect region click: one table for each set, display vertically align
             * 
             * the `d` is :
            *   {sets: [name of the sets],
            *    size: length of the intersection,
            *    record_idx: [the index of dataset holding the records],
            *    intersect: [intersect gene names],
            *    records: [{table, setName}]}
             */
            var records = d.records;
            var result_tables = records.map(record => {
                var nrows = record['table'].length;
                var res_table = `<div class = "table-content"><a href="#" class="download-btn">Download CSV</a><h4>${record['setName']}</h4>${nrows} ${records.length === 1 ? 'unique' : 'shared'} items<br>`;
                // table header
                res_table += '<table><thead><tr>'
                for (let th of csv_headers_str) {
                    res_table += `<th>${th}</th>`
                }
                res_table += '</tr></thead><tbody>';
                // table body
                for (let j = 0; j < nrows; j++) {
                    res_table += '<tr>'
                    for (let th of csv_headers_str) {
                        res_table += `<td>${record['table'][j][th]}</td>`
                    }
                    res_table += `</tr>`;
                }
                res_table += '</tbody></table></div>'

                return res_table
            })
            document.querySelector('.panel-content').innerHTML = result_tables.join('');

            // download table as a csv file
            const downloadBtns = document.querySelectorAll('.table-content .download-btn');

            downloadBtns.forEach(downloadBtn => {
                const tableBody = downloadBtn.parentElement.querySelectorAll('tbody tr');
                const tableHeaders = downloadBtn.parentElement.querySelectorAll('thead th');
                let csvContent = '';

                // generate CSV content
                for (let i = 0; i < tableHeaders.length; i++) {
                    csvContent += `"${tableHeaders[i].textContent}",`;
                }
                csvContent = csvContent.slice(0, -1) + '\r\n'; // remove trailing comma and add line break

                tableBody.forEach(row => {
                    const rowData = row.querySelectorAll('td');
                    let rowArray = Array.from(rowData).map(td => {
                        if (td.textContent.includes(",")) {
                            return `"${td.textContent.replace(/"/g, '""')}"`; // add quotes and escape inner quotes
                        }
                        return td.textContent;
                    });
                    csvContent += rowArray.join(',') + '\r\n';
                });

                // create temporary link and download CSV file
                const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
                downloadBtn.setAttribute('href', encodedUri);
                downloadBtn.setAttribute('download', `${downloadBtn.parentElement.querySelector('h4').textContent}.csv`);
            })



        })

        .on("mousemove", function () {
            tooltip.style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })

        .on("mouseout", function (d, i) {
            tooltip.transition().duration(200).style("opacity", 0);
            var selection = d3.select(this).transition("tooltip").duration(200);
            selection.select("path")
                .style("stroke-width", 0)
                .style("fill-opacity", d.sets.length == 1 ? .25 : .0)
                .style("stroke-opacity", 0);
        });

}

// ===========================================================
// **************** set information box control **************
// ===========================================================
function addBox() {
    let newNode = document
        .querySelector('.set-information')
        .cloneNode(true);
    // clear all information
    newNode.querySelector("input[type='file']").value = "";
    newNode.querySelector("input[type='text']").value = "";
    newNode.querySelector("span").innerText = "Choose File";
    // new random suffixing on names and ids
    let new_group_suffix = random4chars();
    // reverse log2 fold change checkbox
    let checkbox = newNode.querySelector(".dataFilter-paras input[type='checkbox']");
    checkbox.checked = false;
    checkbox.id = `reverse_fc_${new_group_suffix}`;
    checkbox.parentNode.querySelector("label").setAttribute("for", `reverse_fc_${new_group_suffix}`);
    // up/down-regulation radio groups
    newNode.querySelectorAll(".dataFilter-paras input[type='radio']")
        .forEach(o => {
            o.name = `regulation_${new_group_suffix}`;
            o.id = `${o.value}_regulation_${new_group_suffix}`;
            o.nextElementSibling.setAttribute("for", `${o.value}_regulation_${new_group_suffix}`)
        })

    document
        .querySelector('.web-gadgets')
        .appendChild(newNode);

    overwrite_listers();
}

function removeBox() {
    let parent_box = document.querySelector('.web-gadgets');
    if (parent_box.childElementCount > 3) {
        parent_box.removeChild(parent_box.lastChild);
    }
}


// ===========================================================
// *********************** listeners *******************
// ===========================================================
const overwrite_listers = () => {

    // file picker 
    document.querySelectorAll("input[type='file']")
        .forEach(dom => {
            dom.addEventListener('change', (event) => {
                const file = event.target.files[0];
                // fill in the name in the input
                let input_dom = event.target
                    .parentNode
                    .parentNode
                    .querySelector('input[type="text"][name="set-name"]');
                if (input_dom.value == "") {
                    input_dom.value = file.name.replace(".csv", "");
                    input_dom.dispatchEvent(new Event("change"));
                }
                // change the "Choose File" to the file name
                let span_dom = event.target
                    .parentNode
                    .querySelector('span');
                span_dom.innerText = file.name.slice(-20)
            });
        })

    // clear file picker and input name
    document.querySelectorAll('.clear-file')
        .forEach(i => i.addEventListener('click', event => {
            let parent = event.target.parentNode;
            parent.querySelectorAll("input")
                .forEach(input => input.value = "")
            parent.querySelector("span").innerText = "Choose File"
        }))



}

// interrogate radio
document.querySelector(".interrogation-group").addEventListener("click", event => {
    if (event.target && event.target.matches("input[type='radio']")) {
        if (event.target.value == 'pathway') {
            // hide reverse FoldChange & up/down-regulation radio
            document.querySelectorAll(".dataFilter-paras")
                .forEach(o => o.style.display = "none")

            // change the default headers
            document.querySelector("#csv_headers_q_value").value = "q-value"
            document.querySelector("#csv_headers_id").value = "term"
            document.querySelector("#csv_headers_log_FC").value = "log2FoldChange"
            document.querySelector("#csv_headers_log_FC").disabled = true
            document.querySelector("#csv_headers_log_FC").parentElement.style.textDecoration = "line-through";
            document.querySelector("#csv_headers_str").value = "term,q-value,combined_score,overlap_genes"
            init_csv_headers()
        }
        if (event.target.value == 'gene-set') {
            // display reverse FoldChange & up/down-regulation radio
            document.querySelectorAll(".dataFilter-paras")
                .forEach(o => o.style.display = "")

            // change the default headers
            document.querySelector("#csv_headers_q_value").value = "p_val_adj"
            document.querySelector("#csv_headers_id").value = "gene"
            document.querySelector("#csv_headers_log_FC").value = "avg_log2FC"
            document.querySelector("#csv_headers_log_FC").disabled = false
            document.querySelector("#csv_headers_log_FC").parentElement.style.textDecoration = "none";
            document.querySelector("#csv_headers_str").value = "gene,p_val,avg_log2FC,p_val_adj"
            init_csv_headers()
        }
    }
})

overwrite_listers();

// initialise the values, then change onchange
const init_csv_headers = () => {
    p_adjust = parseFloat(document.querySelector("#p_adjust_val").value)
    csv_p_adj_str = document.querySelector("#csv_headers_q_value").value
    csv_gene_str = document.querySelector("#csv_headers_id").value
    csv_log2FC_str = document.querySelector("#csv_headers_log_FC").value
    csv_headers_str = document.querySelector("#csv_headers_str").value.split(",").map(o => o.trim())
}

init_csv_headers()

document.querySelector("#p_adjust_val")
    .addEventListener('change', e => p_adjust = parseFloat(e.target.value))
document.querySelector("#csv_headers_q_value")
    .addEventListener("change", (e) => csv_p_adj_str = e.target.value)
document.querySelector("#csv_headers_id")
    .addEventListener("change", (e) => csv_gene_str = e.target.value)
document.querySelector("#csv_headers_log_FC")
    .addEventListener("change", (e) => csv_log2FC_str = e.target.value)
document.querySelector("#csv_headers_str")
    .addEventListener("change", (e) => csv_headers_str = e.target.value.split(",").map(o => o.trim()))


document.getElementById("panel").addEventListener('click', function (event) {
    if (!document.querySelector('.panel-content').contains(event.target)) {
        document.getElementById("panel").classList.add("hidden");
    }
});

document.getElementById("createChart").addEventListener('click', async event => {
    let data = await map_csv();
    plot_update(data)
});