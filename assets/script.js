// Main Application
class QuakePHMap {
    constructor() {
        // DOM Elements
        this.sidebar = document.getElementById('sidebar');
        this.toggleSidebar = document.getElementById('toggleSidebar');
        this.mobileToggle = document.getElementById('mobileToggle');
        this.layerButtons = document.querySelectorAll('.layer-btn');
        this.mapLayers = {
            base: document.getElementById('baseMap'),
            hazard: document.getElementById('hazardMap'),
            risk: document.getElementById('riskMap')
        };
        this.currentLayerTitle = document.getElementById('currentLayerTitle');
        this.legendContent = document.getElementById('legendContent');
        this.lastUpdate = document.getElementById('lastUpdate');
        this.quakeList = document.getElementById('quakeList');
        this.quakePanel = document.getElementById('quakePanel');
        this.closeQuakePanel = document.getElementById('closeQuakePanel');
        this.toggleQuakePanel = document.getElementById('toggleQuakePanel');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.locateBtn = document.getElementById('locateBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.quakeCount = document.getElementById('quakeCount');
        this.toggleLayers = document.getElementById('toggleLayers');
        
        // Map Variables
        this.map = null;
        this.quakeMarkers = [];
        this.faultLines = null;
        this.earthquakeData = [];
        this.currentLayer = 'earthquake';
        this.autoRefreshInterval = null;
        
        // Initialize
        this.initMap();
        this.initEventListeners();
        this.loadFaultLines();
        this.loadEarthquakeData();
        this.setupAutoRefresh();
        this.updateLegend();
    }
    
    // Initialize Leaflet Map
    initMap() {
        // Create map centered on Philippines
        this.map = L.map('baseMap', {
            center: [12.8797, 121.7740], // Center of Philippines
            zoom: 6,
            zoomControl: true,
            attributionControl: false
        });
        
        // Add base tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Add scale control
        L.control.scale({ imperial: false }).addTo(this.map);
        
        // Add custom attribution
        L.control.attribution({
            position: 'bottomright'
        }).addTo(this.map).addAttribution('QuakePH | Philippine Earthquake Monitor');
        
        // Create layer groups
        this.quakeLayerGroup = L.layerGroup().addTo(this.map);
        this.faultLayerGroup = L.layerGroup();
    }
    
    // Load fault lines data
    loadFaultLines() {
        fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json')
            .then(response => response.json())
            .then(data => {
                this.faultLines = L.geoJSON(data, {
                    style: {
                        color: '#facc15',
                        weight: 2,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    },
                    onEachFeature: (feature, layer) => {
                        if (feature.properties && feature.properties.Name) {
                            layer.bindPopup(`<b>Fault Line:</b> ${feature.properties.Name}`);
                        }
                    }
                });
                
                // Add to layer group
                this.faultLayerGroup.addLayer(this.faultLines);
            })
            .catch(error => {
                console.error('Error loading fault lines:', error);
            });
    }
    
    // Load earthquake data from USGS
    loadEarthquakeData() {
        this.showLoading(true);
        
        fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson')
            .then(response => response.json())
            .then(data => {
                this.earthquakeData = data.features;
                this.displayEarthquakes();
                this.updateEarthquakeList();
                this.updateLastUpdateTime();
                this.showLoading(false);
            })
            .catch(error => {
                console.error('Error loading earthquake data:', error);
                this.showLoading(false);
                this.showError('Failed to load earthquake data. Please try again.');
            });
    }
    
    // Display earthquakes on map
    displayEarthquakes() {
        // Clear existing markers
        this.quakeLayerGroup.clearLayers();
        this.quakeMarkers = [];
        
        this.earthquakeData.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const latlng = [coords[1], coords[0]];
            const mag = feature.properties.mag;
            const place = feature.properties.place;
            const time = new Date(feature.properties.time);
            
            // Determine color based on magnitude
            const color = this.getMagnitudeColor(mag);
            const radius = this.getMarkerRadius(mag);
            
            // Create custom marker
            const marker = L.circleMarker(latlng, {
                radius: radius,
                fillColor: color,
                color: '#ffffff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.7
            });
            
            // Create popup content
            const popupContent = `
                <div class="quake-popup">
                    <h3>M ${mag.toFixed(1)}</h3>
                    <p><strong>Location:</strong> ${place}</p>
                    <p><strong>Time:</strong> ${time.toLocaleString()}</p>
                    <p><strong>Depth:</strong> ${coords[2].toFixed(1)} km</p>
                    <p><strong>Status:</strong> ${feature.properties.status}</p>
                    <button onclick="quakeMap.zoomToEarthquake(${coords[1]}, ${coords[0]})" 
                            style="margin-top: 10px; padding: 5px 10px; background: #00b4d8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Zoom to Location
                    </button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            marker.addTo(this.quakeLayerGroup);
            
            // Store marker reference
            this.quakeMarkers.push({
                marker: marker,
                magnitude: mag,
                time: time
            });
        });
        
        // Update earthquake count badge
        this.quakeCount.textContent = this.earthquakeData.length;
    }
    
    // Update earthquake list in sidebar
    updateEarthquakeList() {
        this.quakeList.innerHTML = '';
        
        // Sort by magnitude (highest first)
        const sortedQuakes = [...this.earthquakeData].sort((a, b) => b.properties.mag - a.properties.mag);
        
        sortedQuakes.forEach(feature => {
            const mag = feature.properties.mag;
            const place = feature.properties.place;
            const time = new Date(feature.properties.time);
            const coords = feature.geometry.coordinates;
            
            const quakeItem = document.createElement('div');
            quakeItem.className = 'quake-item';
            quakeItem.style.borderLeftColor = this.getMagnitudeColor(mag);
            quakeItem.innerHTML = `
                <div class="quake-magnitude" style="color: ${this.getMagnitudeColor(mag)}">
                    M ${mag.toFixed(1)}
                </div>
                <div class="quake-location">${place}</div>
                <div class="quake-time">
                    <i class="far fa-clock"></i>
                    ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            `;
            
            // Add click event to zoom to earthquake
            quakeItem.addEventListener('click', () => {
                this.zoomToEarthquake(coords[1], coords[0]);
                this.highlightEarthquakeMarker(coords[1], coords[0]);
            });
            
            this.quakeList.appendChild(quakeItem);
        });
    }
    
    // Zoom to specific earthquake location
    zoomToEarthquake(lat, lng) {
        this.map.setView([lat, lng], 8);
        
        // Find and open marker popup
        const marker = this.quakeMarkers.find(m => 
            m.marker.getLatLng().lat === lat && m.marker.getLatLng().lng === lng
        );
        
        if (marker) {
            marker.marker.openPopup();
        }
    }
    
    // Highlight earthquake marker
    highlightEarthquakeMarker(lat, lng) {
        this.quakeMarkers.forEach(m => {
            const markerLat = m.marker.getLatLng().lat;
            const markerLng = m.marker.getLatLng().lng;
            
            if (markerLat === lat && markerLng === lng) {
                m.marker.setStyle({
                    color: '#ffffff',
                    weight: 3,
                    fillOpacity: 0.9
                });
                
                // Reset style after 3 seconds
                setTimeout(() => {
                    m.marker.setStyle({
                        color: '#ffffff',
                        weight: 1,
                        fillOpacity: 0.7
                    });
                }, 3000);
            }
        });
    }
    
    // Get color based on magnitude
    getMagnitudeColor(magnitude) {
        if (magnitude < 3) return '#4cd964'; // Green
        if (magnitude < 4) return '#ffcc00'; // Yellow
        if (magnitude < 5) return '#ff9500'; // Orange
        if (magnitude < 6) return '#ff3b30'; // Red
        return '#8b0000'; // Dark Red for 6+
    }
    
    // Get marker radius based on magnitude
    getMarkerRadius(magnitude) {
        return Math.max(magnitude * 3, 8);
    }
    
    // Update legend based on current layer
    updateLegend() {
        let legendHTML = '';
        
        if (this.currentLayer === 'earthquake') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-color" style="background: #4cd964;"></div>
                    <span>Magnitude < 3.0</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ffcc00;"></div>
                    <span>Magnitude 3.0 - 3.9</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ff9500;"></div>
                    <span>Magnitude 4.0 - 4.9</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ff3b30;"></div>
                    <span>Magnitude 5.0 - 5.9</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #8b0000;"></div>
                    <span>Magnitude ≥ 6.0</span>
                </div>
            `;
        } else if (this.currentLayer === 'hazard') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-info">
                        <p>Seismic Hazard Map shows probability of strong ground shaking.</p>
                        <p>Colors indicate Peak Ground Acceleration (PGA).</p>
                    </div>
                </div>
            `;
        } else if (this.currentLayer === 'risk') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-info">
                        <p>Seismic Risk Map shows estimated economic losses.</p>
                        <p>Darker colors indicate higher risk areas.</p>
                    </div>
                </div>
            `;
        } else if (this.currentLayer === 'fault') {
            legendHTML = `
                <div class="legend-item">
                    <div class="legend-color" style="background: #facc15;"></div>
                    <span>Major Fault Lines</span>
                </div>
            `;
        }
        
        this.legendContent.innerHTML = legendHTML;
    }
    
    // Update last update time
    updateLastUpdateTime() {
        const now = new Date();
        this.lastUpdate.textContent = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    // Show/hide loading overlay
    showLoading(show) {
        if (show) {
            this.loadingOverlay.style.display = 'flex';
        } else {
            this.loadingOverlay.style.display = 'none';
        }
    }
    
    // Show error message
    showError(message) {
        alert(message);
    }
    
    // Setup auto-refresh of earthquake data
    setupAutoRefresh() {
        // Clear existing interval
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Set new interval (5 minutes)
        this.autoRefreshInterval = setInterval(() => {
            this.loadEarthquakeData();
        }, 5 * 60 * 1000);
    }
    
    // Switch between map layers
    switchLayer(layerId) {
        // Hide all layers
        Object.values(this.mapLayers).forEach(layer => {
            layer.classList.remove('active');
        });
        
        // Remove fault lines from map
        if (this.faultLayerGroup && this.map.hasLayer(this.faultLayerGroup)) {
            this.map.removeLayer(this.faultLayerGroup);
        }
        
        // Update current layer
        this.currentLayer = layerId;
        
        // Show selected layer
        if (layerId === 'earthquake') {
            this.mapLayers.base.classList.add('active');
            this.currentLayerTitle.textContent = 'Philippine Earthquake Map';
            this.map.invalidateSize();
        } 
        else if (layerId === 'hazard') {
            this.mapLayers.hazard.classList.add('active');
            this.currentLayerTitle.textContent = 'Seismic Hazard Map';
        }
        else if (layerId === 'risk') {
            this.mapLayers.risk.classList.add('active');
            this.currentLayerTitle.textContent = 'Seismic Risk Map';
        }
        else if (layerId === 'fault') {
            this.mapLayers.base.classList.add('active');
            this.currentLayerTitle.textContent = 'Philippine Fault Lines';
            
            // Add fault lines to map
            if (this.faultLines) {
                this.map.addLayer(this.faultLayerGroup);
                this.map.invalidateSize();
            }
        }
        
        // Update legend
        this.updateLegend();
    }
    
    // Toggle sidebar
    toggleSidebarView() {
        this.sidebar.classList.toggle('collapsed');
        this.sidebar.classList.toggle('active');
        
        // Update toggle button icon
        const icon = this.toggleSidebar.querySelector('i');
        if (this.sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-left';
        }
        
        // Invalidate map size when sidebar changes
        setTimeout(() => {
            this.map.invalidateSize();
        }, 300);
    }
    
    // Toggle earthquake panel
    toggleEarthquakePanel() {
        this.quakePanel.classList.toggle('active');
    }
    
    // Locate user
    locateUser() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by your browser');
            return;
        }
        
        this.showLoading(true);
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.map.setView([latitude, longitude], 10);
                this.showLoading(false);
                
                // Add user marker
                L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'user-marker',
                        html: '<i class="fas fa-user" style="color: #00b4d8; font-size: 24px;"></i>',
                        iconSize: [30, 30]
                    })
                })
                .addTo(this.map)
                .bindPopup('Your Location')
                .openPopup();
            },
            (error) => {
                this.showLoading(false);
                this.showError('Unable to retrieve your location');
            }
        );
    }
    
    // Toggle fullscreen
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
    
    // Initialize event listeners
    initEventListeners() {
        // Sidebar toggle
        this.toggleSidebar.addEventListener('click', () => this.toggleSidebarView());
        this.mobileToggle.addEventListener('click', () => this.toggleSidebarView());
        
        // Layer buttons
        this.layerButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update button states
                this.layerButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Switch layer
                const layerId = button.dataset.layer;
                this.switchLayer(layerId);
            });
        });
        
        // Earthquake panel
        this.toggleQuakePanel.addEventListener('click', () => this.toggleEarthquakePanel());
        this.closeQuakePanel.addEventListener('click', () => this.toggleEarthquakePanel());
        
        // Control buttons
        this.refreshBtn.addEventListener('click', () => this.loadEarthquakeData());
        this.locateBtn.addEventListener('click', () => this.locateUser());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.toggleLayers.addEventListener('click', () => this.toggleSidebarView());
        
        // Fullscreen change event
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 300);
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        });
        
        // Close earthquake panel when clicking outside on mobile
        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 768 && 
                this.quakePanel.classList.contains('active') &&
                !this.quakePanel.contains(event.target) &&
                !this.toggleQuakePanel.contains(event.target)) {
                this.toggleEarthquakePanel();
            }
        });
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.quakeMap = new QuakePHMap();
});