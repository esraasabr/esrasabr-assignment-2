// Global variables to hold the dataset and the current KMeans state
let currentData = [];
let currentCentroids = [];
let currentClusters = [];
let currentStep = 0;

// Function to generate a new random dataset
function generateNewDataset() {
    currentData = [...Array(300)].map(() => [Math.random(), Math.random()]);
    console.log("New dataset generated:", currentData);
    plotClusters([], []);  // Clear the plot when generating a new dataset
}

// Function to run KMeans clustering
function runKMeans(data, k, method) {
    fetch('/kmeans', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data: data,
            k: k,
            method: method
        })
    })
    .then(response => response.json())
    .then(result => {
        currentCentroids = result.centroids;
        currentClusters = result.clusters;
        console.log('Centroids:', result.centroids);
        console.log('Clusters:', result.clusters);
    
        // Plot the final result when "Go to Convergence" is triggered
        plotClusters(currentClusters, currentCentroids);
    })

    

    .catch(error => {
        console.error('Error:', error);
    });
}

// Function to plot clusters and centroids
function plotClusters(clusters, centroids) {
    // Prepare traces for each cluster
    const traces = clusters.map((cluster, idx) => ({
        x: cluster.map(p => p[0]),
        y: cluster.map(p => p[1]),
        mode: 'markers',
        marker: { size: 10 },
        name: `Cluster ${idx + 1}`
    }));

    // Add a trace for the centroids
    const centroid_trace = {
        x: centroids.map(c => c[0]),
        y: centroids.map(c => c[1]),
        mode: 'markers',
        marker: { size: 12, symbol: 'x', color: 'black' },
        name: 'Centroids'
    };

    // Plot the result
    Plotly.newPlot('kmeans-plot', [...traces, centroid_trace]);

    // Set up click event listener for selecting centroids
    const plotArea = document.getElementById('kmeans-plot'); // Use your actual plot ID

    plotArea.on('plotly_click', function(data) {
        const x = data.points[0].x;
        const y = data.points[0].y;

        // Add the clicked point as a new centroid
        addCentroid(x, y);
    });
}

// Function to manage centroids
let centroids = [];

function addCentroid(x, y) {
    centroids.push([x, y]);
    updateCentroidsDisplay();
    sendCentroidsToBackend(); // Optionally send to the backend immediately
}

function updateCentroidsDisplay() {
    // Prepare the cluster traces based on the current clusters
    const cluster_traces = currentClusters.map((cluster, idx) => ({
        x: cluster.map(p => p[0]),
        y: cluster.map(p => p[1]),
        mode: 'markers',
        marker: { size: 10 },
        name: `Cluster ${idx + 1}`
    }));

    // Trace for the manually selected centroids
    const centroid_trace = {
        x: centroids.map(c => c[0]),
        y: centroids.map(c => c[1]),
        mode: 'markers',
        marker: { size: 12, symbol: 'x', color: 'red' }, // Style for selected centroids
        name: 'Selected Centroids'
    };

    // Update the plot with both clusters and selected centroids
    Plotly.react('kmeans-plot', [...cluster_traces, centroid_trace]);
}


function sendCentroidsToBackend() {
    const k = parseInt(document.getElementById('clusters').value); // Get the desired number of clusters

    if (centroids.length === k) {
        fetch('/kmeans/select_centroids', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ centroids: centroids })
        })
        .then(response => response.json())
        .then(data => {
            console.log(data.message);
        })
        .catch(error => {
            console.error('Error:', error);
        });
    } else {
        console.log(`Please select exactly ${k} centroids.`);
    }
}


// Function to step through KMeans
function stepThroughKMeans(data, k, method) {
    fetch('/kmeans/step', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            data: data,
            k: k,
            method: method,
            step: currentStep
        })
    })
    .then(response => response.json())
    .then(result => {
        currentCentroids = result.centroids;
        currentClusters = result.clusters;
        console.log('Step', currentStep, 'Centroids:', result.centroids);
        console.log('Step', currentStep, 'Clusters:', result.clusters);

        // Increment the step
        currentStep += 1;

        // Plot the intermediate step result
        plotClusters(currentClusters, currentCentroids);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

// Function to reset the algorithm
function resetAlgorithm() {
    currentData = [];
    currentCentroids = [];
    currentClusters = [];
    currentStep = 0;

    document.getElementById('clusters').value = 0;  // Reset to default value
    document.getElementById('method').value = 'random';  // Reset method selection

    plotClusters([], []);  // Clear the plot
    console.log("Algorithm reset");
}

// (Optional) Call this to test immediately on page load with sample data
document.addEventListener('DOMContentLoaded', () => {
    generateNewDataset();  // Generate a new dataset on page load
});

// Event listeners for buttons
document.getElementById('generate-data').addEventListener('click', generateNewDataset);
document.getElementById('step-through').addEventListener('click', function () {
    const k = parseInt(document.getElementById('clusters').value);
    const method = document.getElementById('method').value;
    stepThroughKMeans(currentData, k, method);
});
document.getElementById('go-to-convergence').addEventListener('click', function () {
    const k = parseInt(document.getElementById('clusters').value);
    const method = document.getElementById('method').value;
    runKMeans(currentData, k, method);
});
document.getElementById('reset').addEventListener('click', resetAlgorithm);
