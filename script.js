document.addEventListener('DOMContentLoaded', function () {
    // Variables to store the dataset and KMeans state
    let data = [];
    let currentStep = 0;
    let centroids = [];
    let clusters = [];
    let manualCentroids = []; // For manual selection of centroids

    // Function to generate a new random dataset
    function generateNewDataset() {
        data = [...Array(300)].map(() => [Math.random(), Math.random()]);
        currentStep = 0;
        resetVisualization();
        console.log('New dataset generated');
    }

    // Function to reset the algorithm and visualization
    function resetAlgorithm() {
        fetch('/kmeans/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(result => {
            Plotly.newPlot('kmeans-plot', result.data, result.layout);
            alert(result.message);
        })
        .catch(error => console.error('Error resetting KMeans:', error));
        
        centroids = []; // Reset centroids
        manualCentroids = []; // Reset manual centroids
    }

    function animateCentroids(newCentroids) {
        const centroidUpdate = centroids.map((centroid, index) => {
            return {
                x: newCentroids[index][0],
                y: newCentroids[index][1]
            };
        });

        Plotly.animate('kmeans-plot', {
            data: [{
                x: centroidUpdate.map(c => c.x),
                y: centroidUpdate.map(c => c.y),
            }],
            traces: [centroids.length],  // Assuming the last trace is the centroid trace
            layout: {}
        }, {
            transition: {
                duration: 1000  // Duration of the transition
            },
            frame: {
                duration: 500,  // Time between each frame
                redraw: true
            }
        });
    }

    // Function to step through the KMeans algorithm
    function stepThroughKMeans() {
        const k = parseInt(document.getElementById('clusters').value);
        const method = document.getElementById('method').value;

        fetch('/kmeans/step', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: data,
                k: k,
                method: method,
                step: currentStep  // Pass the current step to the backend
            })
        })
        .then(response => response.json())
        .then(result => {
            centroids = result.centroids;
            clusters = result.clusters;
            currentStep++;

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

            // Call animateCentroids to visualize the movement
            animateCentroids(centroids);

            // Schedule the next step with a longer delay
            if (result.converged) {
                alert("KMeans has converged.");
            } else {
                currentStep++;
                setTimeout(stepThroughKMeans, 200);  // Adjust the interval as needed
            }
        })
        .catch(error => console.error('Error:', error));
    }

    // Function to go straight to convergence
    function goToConvergence() {
        const k = document.getElementById('clusters').value;
        const method = document.getElementById('method').value;

        fetch('/kmeans/converge', {
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
            centroids = result.centroids;
            clusters = result.clusters;

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

            alert("KMeans has converged.");
        })
        .catch(error => console.error('Error:', error));
    }

    // Function to reset the visualization
    function resetVisualization() {
        Plotly.purge('kmeans-plot');  // Clear the plot
        centroids = []; // Reset centroids
        manualCentroids = []; // Reset manual centroids
    }

    // Function to initialize centroids based on the selected method
    function initializeCentroids() {
        const method = document.getElementById('method').value;
        const k = parseInt(document.getElementById('clusters').value);
        console.log('Initialization method:', method);

        // Reset manual centroids if a new initialization method is chosen
        manualCentroids = [];

        if (method === 'manual') {
            alert("Click on the plot to select centroids.");
            return; // Skip automatic initialization for manual
        }

        // Automatically initialize centroids based on the method
        if (method === 'random') {
            centroids = randomInitialization(data, k);
        } else if (method === 'farthestFirst') {
            centroids = farthestFirstInitialization(data, k);
        } else if (method === 'kmeansPlusPlus') {
            centroids = kmeansPlusPlusInitialization(data, k);
        }
        console.log("Initialized centroids:", centroids);
        // You can then call a function to visualize the initialized centroids if needed
    }

    // Example functions for initialization methods
    function randomInitialization(points, k) {
        const shuffled = points.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, k);
    }

    function farthestFirstInitialization(points, k) {
        const centroids = [points[Math.floor(Math.random() * points.length)]];
        while (centroids.length < k) {
            const distances = points.map(p => Math.min(...centroids.map(c => euclideanDistance(p, c))));
            const nextCentroid = points[distances.indexOf(Math.max(...distances))];
            centroids.push(nextCentroid);
        }
        return centroids;
    }

    function kmeansPlusPlusInitialization(points, k) {
        const centroids = [points[Math.floor(Math.random() * points.length)]];
        while (centroids.length < k) {
            const distances = points.map(p => Math.min(...centroids.map(c => euclideanDistance(p, c))));
            const probabilities = distances.map(d => d ** 2 / distances.reduce((a, b) => a + b));
            const nextCentroid = points[weightedRandomSelection(probabilities)];
            centroids.push(nextCentroid);
        }
        return centroids;
    }

    // Utility functions
    function euclideanDistance(point1, point2) {
        return Math.sqrt(Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2));
    }

    function weightedRandomSelection(probabilities) {
        const total = probabilities.reduce((a, b) => a + b);
        const rand = Math.random() * total;
        let cumulative = 0;
        for (let i = 0; i < probabilities.length; i++) {
            cumulative += probabilities[i];
            if (rand < cumulative) {
                return i;
            }
        }
    }

    // Event listener for form submission
    document.getElementById('kmeans-form').addEventListener('submit', function (e) {
        e.preventDefault();

        // Get the number of clusters and initialization method from the form
        const k = document.getElementById('clusters').value;
        const method = document.getElementById('method').value;

        // Call the appropriate initialization method
        initializeCentroids();

        // Send the data to the Flask backend
        fetch('/kmeans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: data, k: k, method: method })
        })
        .then(response => response.json())
        .then(result => {
            const centroids = result.centroids;
            const clusters = result.clusters;

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
            alert('KMeans initialized and plotted.');
        })
        .catch(error => console.error('Error:', error));
    });

    // Event listeners for buttons
    document.getElementById('generate-data').addEventListener('click', generateNewDataset);
    document.getElementById('reset').addEventListener('click', resetAlgorithm);
    document.getElementById('step').addEventListener('click', stepThroughKMeans);
    document.getElementById('converge').addEventListener('click', goToConvergence);

    // Event listener for plot clicks (for manual centroid selection)
    document.getElementById('kmeans-plot').addEventListener('click', function (event) {
        if (document.getElementById('method').value === 'manual') {
            const coords = getEventPosition(event);
            if (manualCentroids.length < parseInt(document.getElementById('clusters').value)) { // Limit to k centroids
                manualCentroids.push([coords.x, coords.y]);
                console.log("Manual centroid added:", coords);
                // Optionally redraw the centroids on the plot
                updateCentroidsPlot();
            }
        }
    });

    function getEventPosition(event) {
        const plotArea = document.getElementById('kmeans-plot');
        const bounds = plotArea.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width;
        const y = (event.clientY - bounds.top) / bounds.height;
        return { x: x, y: y };
    }

    function updateCentroidsPlot() {
        // Update the plot with manual centroids if needed
        const centroid_trace = {
            x: manualCentroids.map(c => c[0]),
            y: manualCentroids.map(c => c[1]),
            mode: 'markers',
            marker: { size: 12, symbol: 'x', color: 'red' },
            name: 'Manual Centroids'
        };

        Plotly.addTraces('kmeans-plot', centroid_trace);
    }
});
