from flask import Flask, render_template, jsonify, request
import numpy as np
import random
import time

app = Flask(__name__)


# Euclidean distance function
def euclidean_distance(point1, point2):
    return np.sqrt(np.sum((np.array(point1) - np.array(point2)) ** 2))

# Initialize centroids function
def initialize_centroids(data, k, method="random"):
    if method == "random":
        return random_centroids(data, k)
    elif method == "farthest_first":
        return farthest_first_centroids(data, k)
    elif method == "kmeans++":
        return kmeans_plus_plus(data, k)
    elif method == "manual":
        return data[:k]
    else:
        raise ValueError("Unknown initialization method")

# Random initialization
def random_centroids(data, k):
    if k <= 0 or k > len(data):
        raise ValueError(f"Invalid number of clusters: k={k}, must be between 1 and {len(data)}.")
    return random.sample(data.tolist(), k)

# Farthest-first initialization
def farthest_first_centroids(data, k):
    centroids = [random.choice(data)]  # Start with one random centroid
    for _ in range(1, k):
        distances = np.array([min([euclidean_distance(p, c) for c in centroids]) for p in data])
        next_centroid = data[np.argmax(distances)]
        centroids.append(next_centroid)
    return np.array(centroids)

# KMeans++ initialization
def kmeans_plus_plus(data, k):
    if len(data) == 0:
        raise ValueError("Dataset is empty. Cannot initialize centroids.")
    
    centroids = [random.choice(data)]  # Start with one random centroid

    for _ in range(1, k):
        # Calculate distances from each point to the nearest centroid
        distances = np.array([min([euclidean_distance(point, c) for c in centroids]) for point in data])
        
        # Choose a new centroid with probability proportional to the square of the distance
        probabilities = distances / distances.sum()
        cumulative_probabilities = np.cumsum(probabilities)
        r = random.random()

        for i, p in enumerate(cumulative_probabilities):
            if r < p:
                centroids.append(data[i])
                break
    
    return np.array(centroids)



# KMeans algorithm function
def kmeans(data, k, method="random"):
    centroids = initialize_centroids(data, k, method)
    
    for _ in range(100):  # Max iterations
        clusters = [[] for _ in range(k)]
        
        # Assign points to the nearest centroid
        for point in data:
            distances = [euclidean_distance(point, c) for c in centroids]
            nearest_centroid = np.argmin(distances)
            clusters[nearest_centroid].append(point)
        
        # Recalculate centroids
        new_centroids = np.array([
            np.mean(cluster, axis=0) if len(cluster) > 0 else centroids[i] 
            for i, cluster in enumerate(clusters)])
        
        # If centroids do not change, stop the iteration
        if np.all(centroids == new_centroids):
            break
        
        centroids = new_centroids
    
    return centroids, clusters

# Global variables for step-by-step functionality
current_centroids = None
current_clusters = None
current_iteration = 0
max_iterations = 100

# Function to handle one step of KMeans
def kmeans_step(data, k):
    global current_centroids, current_clusters, current_iteration
    
    if current_iteration == 0:
        current_centroids = initialize_centroids(data, k)
        current_clusters = [[] for _ in range(k)]
    
    # Assign points to the nearest centroid
    clusters = [[] for _ in range(k)]
    for point in data:
        distances = [euclidean_distance(point, c) for c in current_centroids]
        nearest_centroid = np.argmin(distances)

        if nearest_centroid < k:
            clusters[nearest_centroid].append(point)

    # Recalculate centroids
    new_centroids = []
    for i in range(k):
        if len(clusters[i]) > 0:
            new_centroids.append(np.mean(clusters[i], axis=0))
        else:
            if i < len(current_centroids):
                new_centroids.append(current_centroids[i])
            # If a cluster is empty, append the previous centroid
            

    new_centroids = np.array(new_centroids)

# Check if centroids have changed
    converged = np.all(current_centroids == new_centroids)

    # Update the global state
    current_centroids = new_centroids
    current_clusters = clusters
    current_iteration += 1

    return current_centroids, current_clusters, converged

# Function to convert numpy arrays to lists
def convert_to_list(data):
    if isinstance(data, np.ndarray):
        return data.tolist()
    elif isinstance(data, list):
        return [convert_to_list(item) for item in data]
    return data

# Home route to render the main page
@app.route('/')
def index():
    return render_template('index.html')


# API route for running the KMeans algorithm
@app.route('/kmeans', methods=['POST'])
def kmeans_api():
    # Get data from the frontend
    data = np.array(request.json['data'])

    if len(data) == 0:
        return jsonify({'error': 'Input data cannot be empty.'}), 400
    
    k = int(request.json['k'])
    method = request.json['method']
    
    
    # Run KMeans
    try:
        centroids, clusters = kmeans(data, k=k, method=method)
        
        # Prepare the response
        centroids_list = centroids.tolist() if isinstance(centroids, np.ndarray) else centroids
        return jsonify({
        'centroids': centroids_list,  # Use the correct type for centroids
        'clusters': [[point.tolist() for point in cluster] for cluster in clusters]
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400  # Return a 400 Bad Request on invalid input


# API route for step-by-step KMeans
@app.route('/kmeans/step', methods=['POST'])
def kmeans_step_api():
    global current_iteration

    # Get data from the frontend
    data = np.array(request.json['data'])
    k = request.json['k']
    method = request.json['method']

    if not k or not str(k).isdigit() or int(k) <= 0:
        return jsonify({'error': 'Invalid value for k'}), 400

    if method not in ['random', 'farthest_first', 'kmeans++', 'manual']:
        return jsonify({'error': 'Invalid method'}), 400

    k = int(k)


    # Run one step of KMeans
    centroids, clusters, converged = kmeans_step(data, k)

    time.sleep(.5)
    
    # Prepare the response
    centroids_list = centroids.tolist() if isinstance(centroids, np.ndarray) else centroids
    converged = bool(converged)
    
    return jsonify({
        'centroids': centroids_list,
        'clusters': [[point.tolist() for point in cluster] for cluster in clusters],
        'iteration': current_iteration,
        'converged': converged
    })

#API route for kmeans coverge
@app.route('/kmeans/converge', methods=['POST'])
def kmeans_converge_api():
    data = np.array(request.json['data'])
    k = int(request.json['k'])
    method = request.json['method']

    # Run KMeans until convergence
    centroids, clusters = kmeans(data, k=k, method=method)  # Adjust max_iters if needed

    return jsonify({
        'centroids': convert_to_list(centroids),  # Use the convert_to_list function here
        'clusters': [convert_to_list(cluster) for cluster in clusters]  # Convert clusters too
    })


# API route to reset KMeans
@app.route('/kmeans/reset', methods=['POST'])
def reset_kmeans():
    global current_centroids, current_clusters, current_iteration  # reset step-related globals

    data = np.array(request.json['data'])
    k = int(request.json['k'])
    
    current_centroids = initialize_centroids(data, k)  # Reset centroids with the new data
    current_clusters = [[] for _ in range(k)]  # Reset clusters
    current_iteration = 0  # Reset the iteration counter

    # Prepare an empty plot response (if needed for visualization purposes)
    blank_trace = {
        'x': [],
        'y': [],
        'mode': 'markers',
        'marker': {'size': 10},
        'name': 'Data Points'
    }

    layout = {
        'title': 'KMeans Clustering Animation',
        'xaxis': {
            'title': 'X-axis',
            'zeroline': True,
            'zerolinecolor' : 'black',
            'zerolinewidth' : 2,
            },
        'yaxis': {
            'title': 'Y-axis',
            'zeroline': True,
            'zerolinecolor' : 'black',
            'zerolinewidth' : 2,
            'side': 'middle'
            }, 
            'showlegend': False,  # Hide the legend if you don't need it
    'plot_bgcolor': 'rgba(0,0,0,0)',  # Transparent background for the plot area
    'paper_bgcolor': 'rgba(255,255,255,0.5)',  # Semi-transparent background for the entire graph
    'margin': {
        'l': 40,
        'r': 40,
        't': 40,
        'b': 40
    },
    }

    return jsonify({
        'data': [blank_trace],
        'layout': layout,
        'message': 'KMeans has been reset.'
    })


@app.route('/kmeans/select_centroids', methods=['POST'])
def select_centroids():
    global centroids  # Use your centroids variable
    data = request.json  # Get the data sent from the frontend
    centroids = data['centroids']  # Update centroids with the received data
    return jsonify({'message': 'Centroids updated successfully!'})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3000, debug=True)
