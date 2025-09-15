// GamePlane JavaScript Functions

class GamePlaneAPI {
    constructor(baseURL = 'http://localhost:8080/api/v1') {
        this.baseURL = baseURL;
    }

    async fetchServers(namespace = 'default') {
        try {
            const url = `${this.baseURL}/gameservers?namespace=${namespace}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch servers');
            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error('Error fetching servers:', error);
            return [];
        }
    }

    async createServer(serverConfig) {
        try {
            const response = await fetch(`${this.baseURL}/gameservers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(serverConfig),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create server');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error creating server:', error);
            throw error;
        }
    }

    async deleteServer(name, namespace = 'default') {
        try {
            const response = await fetch(`${this.baseURL}/gameservers/${namespace}/${name}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete server');
            return await response.json();
        } catch (error) {
            console.error('Error deleting server:', error);
            throw error;
        }
    }

    async restartServer(name, namespace = 'default') {
        try {
            const response = await fetch(`${this.baseURL}/gameservers/${namespace}/${name}/restart`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to restart server');
            return await response.json();
        } catch (error) {
            console.error('Error restarting server:', error);
            throw error;
        }
    }

    async getServerMetrics(name, namespace = 'default') {
        try {
            const response = await fetch(`${this.baseURL}/gameservers/${namespace}/${name}/metrics`);
            if (!response.ok) throw new Error('Failed to fetch metrics');
            return await response.json();
        } catch (error) {
            console.error('Error fetching metrics:', error);
            throw error;
        }
    }
}

// Create global API instance
const api = new GamePlaneAPI();

// Dashboard Functions
async function updateDashboardStats() {
    try {
        const servers = await api.fetchServers();
        
        // Calculate stats
        const runningServers = servers.filter(s => s.status?.phase === 'Running').length;
        const totalServers = servers.length;
        const totalPlayers = servers.reduce((sum, s) => sum + (s.status?.playersOnline || 0), 0);
        
        // Update dashboard cards
        const runningElement = document.getElementById('running-servers');
        const totalElement = document.getElementById('total-servers');
        const playersElement = document.getElementById('total-players');
        
        if (runningElement) runningElement.textContent = runningServers;
        if (totalElement) totalElement.textContent = totalServers;
        if (playersElement) playersElement.textContent = totalPlayers;
        
        // For dashboard, we could show cluster-wide metrics or keep it simple
        // These could be cluster node metrics rather than individual game server metrics
        const cpuUsage = 0; // TODO: Implement cluster node metrics
        const memoryUsage = 0; // TODO: Implement cluster node metrics
        
        const cpuElement = document.getElementById('cpu-usage');
        const memoryElement = document.getElementById('memory-usage');
        
        if (cpuElement) cpuElement.textContent = `${cpuUsage}%`;
        if (memoryElement) memoryElement.textContent = `${memoryUsage}%`;
        
        // Update progress bars
        const cpuBar = cpuElement?.parentElement.querySelector('.progress-bar');
        const memoryBar = memoryElement?.parentElement.querySelector('.progress-bar');
        
        if (cpuBar) {
            cpuBar.style.width = `${cpuUsage}%`;
            cpuBar.setAttribute('aria-valuenow', cpuUsage);
        }
        
        if (memoryBar) {
            memoryBar.style.width = `${memoryUsage}%`;
            memoryBar.setAttribute('aria-valuenow', memoryUsage);
        }
        
    } catch (error) {
        console.error('Failed to update dashboard stats:', error);
    }
}

// Server status badge helper
function getStatusBadge(status) {
    const statusMap = {
        'Running': 'success',
        'Pending': 'warning',
        'Failed': 'danger',
        'Terminating': 'info',
        'Unknown': 'secondary'
    };
    
    const badgeClass = statusMap[status] || 'secondary';
    return `<span class="badge bg-${badgeClass}">${status}</span>`;
}

// Game type badge helper
function getGameTypeBadge(gameType) {
    const gameTypeMap = {
        'sdtd': '7 Days to Die',
        'vh': 'Valheim',
        'pw': 'Palworld',
        'ce': 'Conan Exiles',
        'we': 'Warhammer End Times',
        'ln': 'Last Necromancer'
    };
    
    const displayName = gameTypeMap[gameType] || gameType;
    return `<span class="badge bg-info">${displayName}</span>`;
}

// Resource gauge helper - returns CPU gauge only
function getCpuGauge(serverName, namespace) {
    const serverId = `${namespace}-${serverName}`.replace(/[^a-zA-Z0-9]/g, '-');
    
    return `
        <div id="cpu-gauge-${serverId}" class="text-center">
            <svg width="70" height="70" class="cpu-gauge">
                <circle cx="35" cy="35" r="28" fill="none" stroke="#e9ecef" stroke-width="4"/>
                <circle cx="35" cy="35" r="28" fill="none" stroke="#17a2b8" stroke-width="4" 
                        stroke-dasharray="175.8" stroke-dashoffset="175.8" 
                        style="transform: rotate(-90deg); transform-origin: 35px 35px; transition: stroke-dashoffset 0.5s ease-in-out;"/>
                <text x="35" y="30" text-anchor="middle" font-size="10" fill="#6c757d" font-weight="bold">0%</text>
                <text x="35" y="42" text-anchor="middle" font-size="8" fill="#6c757d">Loading...</text>
            </svg>
        </div>
    `;
}

// Resource gauge helper - returns Memory gauge only  
function getMemoryGauge(serverName, namespace) {
    const serverId = `${namespace}-${serverName}`.replace(/[^a-zA-Z0-9]/g, '-');
    
    return `
        <div id="memory-gauge-${serverId}" class="text-center">
            <svg width="70" height="70" class="memory-gauge">
                <circle cx="35" cy="35" r="28" fill="none" stroke="#e9ecef" stroke-width="4"/>
                <circle cx="35" cy="35" r="28" fill="none" stroke="#ffc107" stroke-width="4" 
                        stroke-dasharray="175.8" stroke-dashoffset="175.8" 
                        style="transform: rotate(-90deg); transform-origin: 35px 35px; transition: stroke-dashoffset 0.5s ease-in-out;"/>
                <text x="35" y="30" text-anchor="middle" font-size="10" fill="#6c757d" font-weight="bold">0%</text>
                <text x="35" y="42" text-anchor="middle" font-size="8" fill="#6c757d">Loading...</text>
            </svg>
        </div>
    `;
}

// Legacy function for backward compatibility
function getResourceGauges(serverName, namespace, resources) {
    if (!resources) return '<span class="text-muted">Not specified</span>';
    
    const serverId = `${namespace}-${serverName}`.replace(/[^a-zA-Z0-9]/g, '-');
    
    return `
        <div id="resource-gauges-${serverId}" class="resource-gauges d-flex gap-3">
            <div class="text-center">
                <svg width="70" height="70" class="cpu-gauge">
                    <circle cx="35" cy="35" r="28" fill="none" stroke="#e9ecef" stroke-width="4"/>
                    <circle cx="35" cy="35" r="28" fill="none" stroke="#17a2b8" stroke-width="4" 
                            stroke-dasharray="175.8" stroke-dashoffset="175.8" 
                            style="transform: rotate(-90deg); transform-origin: 35px 35px; transition: stroke-dashoffset 0.5s ease-in-out;"/>
                    <text x="35" y="30" text-anchor="middle" font-size="10" fill="#6c757d" font-weight="bold">0%</text>
                    <text x="35" y="42" text-anchor="middle" font-size="8" fill="#6c757d">Loading...</text>
                </svg>
            </div>
            <div class="text-center">
                <svg width="70" height="70" class="memory-gauge">
                    <circle cx="35" cy="35" r="28" fill="none" stroke="#e9ecef" stroke-width="4"/>
                    <circle cx="35" cy="35" r="28" fill="none" stroke="#ffc107" stroke-width="4" 
                            stroke-dasharray="175.8" stroke-dashoffset="175.8" 
                            style="transform: rotate(-90deg); transform-origin: 35px 35px; transition: stroke-dashoffset 0.5s ease-in-out;"/>
                    <text x="35" y="30" text-anchor="middle" font-size="10" fill="#6c757d" font-weight="bold">0%</text>
                    <text x="35" y="42" text-anchor="middle" font-size="8" fill="#6c757d">Loading...</text>
                </svg>
            </div>
        </div>
    `;
}

// Update resource gauges with actual metrics
async function updateResourceGauges(serverName, namespace) {
    try {
        const serverId = `${namespace}-${serverName}`.replace(/[^a-zA-Z0-9]/g, '-');
        const cpuGaugeContainer = document.getElementById(`cpu-gauge-${serverId}`);
        const memoryGaugeContainer = document.getElementById(`memory-gauge-${serverId}`);
        
        if (!cpuGaugeContainer && !memoryGaugeContainer) return;
        
        const metrics = await api.getServerMetrics(serverName, namespace);
        
        if (metrics.metrics) {
            const cpuPercentage = metrics.metrics.cpu.percentage || 0;
            const memoryPercentage = metrics.metrics.memory.percentage || 0;
            
            // Update CPU gauge
            if (cpuGaugeContainer) {
                const cpuGauge = cpuGaugeContainer.querySelector('.cpu-gauge');
                if (cpuGauge) {
                    const cpuCircles = cpuGauge.querySelectorAll('circle');
                    const cpuCircle = cpuCircles[1]; // Second circle is the progress circle
                    const cpuTexts = cpuGauge.querySelectorAll('text');
                    const cpuPercentText = cpuTexts[0];
                    const cpuUsageText = cpuTexts[1];
                    
                    if (cpuCircle && cpuPercentText && cpuUsageText) {
                        // Calculate stroke-dashoffset for the percentage (175.8 is the full circumference)
                        const cpuOffset = 175.8 - (Math.min(cpuPercentage, 100) / 100) * 175.8;
                        cpuCircle.style.strokeDashoffset = cpuOffset;
                        
                        // Update text
                        cpuPercentText.textContent = `${Math.round(cpuPercentage)}%`;
                        cpuUsageText.textContent = `${metrics.metrics.cpu.current}/${metrics.metrics.cpu.configured}`;
                        
                        // Change color based on usage
                        let cpuColor = '#17a2b8'; // info
                        if (cpuPercentage > 80) cpuColor = '#dc3545'; // danger
                        else if (cpuPercentage > 60) cpuColor = '#ffc107'; // warning
                        cpuCircle.setAttribute('stroke', cpuColor);
                    }
                }
            }
            
            // Update Memory gauge
            if (memoryGaugeContainer) {
                const memoryGauge = memoryGaugeContainer.querySelector('.memory-gauge');
                if (memoryGauge) {
                    const memoryCircles = memoryGauge.querySelectorAll('circle');
                    const memoryCircle = memoryCircles[1]; // Second circle is the progress circle
                    const memoryTexts = memoryGauge.querySelectorAll('text');
                    const memoryPercentText = memoryTexts[0];
                    const memoryUsageText = memoryTexts[1];
                    
                    if (memoryCircle && memoryPercentText && memoryUsageText) {
                        // Calculate stroke-dashoffset for the percentage
                        const memoryOffset = 175.8 - (Math.min(memoryPercentage, 100) / 100) * 175.8;
                        memoryCircle.style.strokeDashoffset = memoryOffset;
                        
                        // Update text
                        memoryPercentText.textContent = `${Math.round(memoryPercentage)}%`;
                        memoryUsageText.textContent = `${metrics.metrics.memory.current}/${metrics.metrics.memory.configured}`;
                        
                        // Change color based on usage
                        let memoryColor = '#28a745'; // success
                        if (memoryPercentage > 80) memoryColor = '#dc3545'; // danger
                        else if (memoryPercentage > 60) memoryColor = '#ffc107'; // warning
                        memoryCircle.setAttribute('stroke', memoryColor);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Failed to update resource gauges:', error);
        // Show error state
        const serverId = `${namespace}-${serverName}`.replace(/[^a-zA-Z0-9]/g, '-');
        const cpuGaugeContainer = document.getElementById(`cpu-gauge-${serverId}`);
        const memoryGaugeContainer = document.getElementById(`memory-gauge-${serverId}`);
        
        if (cpuGaugeContainer) {
            cpuGaugeContainer.innerHTML = '<small class="text-danger">CPU unavailable</small>';
        }
        if (memoryGaugeContainer) {
            memoryGaugeContainer.innerHTML = '<small class="text-danger">Memory unavailable</small>';
        }
    }
}

// Servers table functions
async function loadServersTable() {
    try {
        const servers = await api.fetchServers();
        
        const tbody = document.getElementById('servers-tbody');
        const loadingElement = document.getElementById('servers-loading');
        const errorElement = document.getElementById('servers-error');
        const emptyElement = document.getElementById('servers-empty');
        const tableContainer = document.getElementById('servers-table-container');
        
        // Hide loading
        if (loadingElement) loadingElement.classList.add('d-none');
        if (errorElement) errorElement.classList.add('d-none');
        
        if (servers.length === 0) {
            if (emptyElement) emptyElement.classList.remove('d-none');
            if (tableContainer) tableContainer.classList.add('d-none');
            return;
        }
        
        // Show table
        if (emptyElement) emptyElement.classList.add('d-none');
        if (tableContainer) tableContainer.classList.remove('d-none');
        
        if (!tbody) return;

        tbody.innerHTML = servers.map(server => {
            const createdDate = new Date(server.metadata.creationTimestamp);
            const resources = server.spec.resources || {};
            
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="fas fa-server text-primary me-2"></i>
                            <div>
                                <div class="fw-bold">${server.metadata.name}</div>
                                <small class="text-muted">${server.spec.gameConfig?.server?.serverDescription || server.spec.gameConfig?.server?.serverName || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>${getGameTypeBadge(server.spec.gameType)}</td>
                    <td>${getStatusBadge(server.status?.phase || 'Unknown')}</td>
                    <td>
                        <div class="text-center">
                            <span class="fw-bold">${server.status?.playersOnline || 0}</span>/${server.spec.gameConfig?.server?.maxPlayers || 'N/A'}
                        </div>
                    </td>
                    <td class="text-center align-middle" style="width: 100px;">${getCpuGauge(server.metadata.name, server.metadata.namespace || 'default')}</td>
                    <td class="text-center align-middle" style="width: 100px;">${getMemoryGauge(server.metadata.name, server.metadata.namespace || 'default')}</td>
                    <td>
                        <small class="text-muted">${createdDate.toLocaleDateString()}</small>
                    </td>
                    <td>
                        <div class="d-flex gap-1" role="group">
                            <button type="button" class="btn btn-sm btn-outline-primary"
                                    onclick="showServerDetails('${server.metadata.name}', '${server.metadata.namespace || 'default'}')"
                                    data-bs-toggle="tooltip" title="View server details and logs">
                                <i class="fas fa-eye me-1"></i>Details
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-info"
                                    onclick="editServer('${server.metadata.name}', '${server.metadata.namespace || 'default'}')"
                                    data-bs-toggle="tooltip" title="Edit server configuration and resources">
                                <i class="fas fa-edit me-1"></i>Edit
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-warning"
                                    onclick="restartServer('${server.metadata.name}', '${server.metadata.namespace || 'default'}')"
                                    data-bs-toggle="tooltip" title="Restart the game server">
                                <i class="fas fa-redo me-1"></i>Restart
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger"
                                    onclick="confirmDeleteServer('${server.metadata.name}', '${server.metadata.namespace || 'default'}')"
                                    data-bs-toggle="tooltip" title="Permanently delete this server">
                                <i class="fas fa-trash me-1"></i>Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Initialize tooltips
        const tooltips = tbody.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
        
        // Load metrics for each server with a small delay to avoid overwhelming the API
        servers.forEach((server, index) => {
            setTimeout(() => {
                updateResourceGauges(server.metadata.name, server.metadata.namespace || 'default');
            }, index * 200); // Stagger requests by 200ms
        });
        
    } catch (error) {
        console.error('Failed to load servers:', error);
        const errorElement = document.getElementById('servers-error');
        const loadingElement = document.getElementById('servers-loading');
        
        if (loadingElement) loadingElement.classList.add('d-none');
        if (errorElement) errorElement.classList.remove('d-none');
    }
}

// Alias for backward compatibility with inline scripts
function loadServers() {
    loadServersTable();
}

// Server management functions
async function restartServer(name, namespace = 'default') {
    if (!confirm(`Are you sure you want to restart ${name}?`)) return;

    try {
        await api.restartServer(name, namespace);
        showNotification(`Server ${name} restarted successfully`, 'success');
        loadServersTable(); // Refresh the table
    } catch (error) {
        showNotification(`Failed to restart ${name}: ${error.message}`, 'error');
    }
}

function confirmDeleteServer(name, namespace = 'default') {
    const modal = document.getElementById('deleteConfirmModal');
    const serverNameElement = document.getElementById('delete-server-name');
    const confirmButton = document.getElementById('confirm-delete');
    
    if (serverNameElement) serverNameElement.textContent = name;
    
    confirmButton.onclick = async () => {
        const modalInstance = bootstrap.Modal.getInstance(modal);
        modalInstance.hide();
        
        try {
            await deleteServer(name, namespace);
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };
    
    new bootstrap.Modal(modal).show();
}

async function deleteServer(name, namespace = 'default') {
    try {
        await api.deleteServer(name, namespace);
        showNotification(`Server ${name} deleted successfully`, 'success');
        loadServersTable(); // Refresh the table
    } catch (error) {
        showNotification(`Failed to delete ${name}: ${error.message}`, 'error');
    }
}

function showServerDetails(name, namespace = 'default') {
    // TODO: Implement server details modal
    showNotification('Server details feature coming soon!', 'info');
}

function editServer(name, namespace = 'default') {
    // TODO: Implement server edit functionality
    showNotification('Server edit feature coming soon!', 'info');
}

// YAML Preview functionality
function previewYAML() {
    const form = document.getElementById('gameserver-form');
    if (!form) {
        showNotification('Form not found', 'error');
        return;
    }

    const formData = new FormData(form);
    const serverConfig = buildServerConfig(formData);
    
    // Convert to YAML-like format for display
    const yamlContent = generateYAMLContent(serverConfig);
    
    // Show in modal
    const yamlCodeElement = document.querySelector('#yaml-content code');
    yamlCodeElement.textContent = yamlContent;
    
    const modal = new bootstrap.Modal(document.getElementById('yamlPreviewModal'));
    modal.show();
}

function buildServerConfig(formData) {
    return {
        apiVersion: "gameplane.kubelize.io/v1alpha1",
        kind: "GameServer",
        metadata: {
            name: formData.get('serverName'),
            namespace: formData.get('namespace') || 'default',
        },
        spec: {
            gameType: formData.get('gameType'),
            gameConfig: {
                server: {
                    serverName: formData.get('serverName'),
                    serverDescription: formData.get('serverDescription') || '',
                    serverPassword: formData.get('serverPassword') || '',
                    maxPlayers: parseInt(formData.get('maxPlayers')) || 8,
                },
                world: {
                    worldName: formData.get('worldName') || 'Dedicated',
                    seed: formData.get('seed') || '',
                    worldSize: formData.get('worldSize') || 'default'
                },
                gameplay: {
                    difficulty: formData.get('difficulty') || 'normal',
                    gameMode: formData.get('gameMode') || 'survival',
                    pvpEnabled: formData.get('pvpEnabled') === 'on',
                    friendlyFire: formData.get('friendlyFire') === 'on'
                },
                performance: {
                    tickRate: parseInt(formData.get('tickRate')) || 60,
                    autoSave: formData.get('autoSave') === 'on',
                    saveInterval: parseInt(formData.get('saveInterval')) || 300
                },
                admin: {
                    adminPassword: formData.get('adminPassword') || '',
                    enableRemoteConsole: formData.get('enableRemoteConsole') === 'on',
                    enableLogging: formData.get('enableLogging') === 'on'
                }
            },
            resources: {
                cpu: formData.get('cpu') || '1000m',
                memory: formData.get('memory') || '2Gi',
                storage: formData.get('storage') || '10Gi'
            }
        }
    };
}

function generateYAMLContent(config) {
    return `apiVersion: ${config.apiVersion}
kind: ${config.kind}
metadata:
  name: ${config.metadata.name}
  namespace: ${config.metadata.namespace}
spec:
  gameType: ${config.spec.gameType}
  gameConfig:
    server:
      serverName: ${config.spec.gameConfig.server.serverName}
      serverDescription: "${config.spec.gameConfig.server.serverDescription}"
      serverPassword: "${config.spec.gameConfig.server.serverPassword}"
      maxPlayers: ${config.spec.gameConfig.server.maxPlayers}
    world:
      worldName: ${config.spec.gameConfig.world.worldName}
      seed: "${config.spec.gameConfig.world.seed}"
      worldSize: ${config.spec.gameConfig.world.worldSize}
    gameplay:
      difficulty: ${config.spec.gameConfig.gameplay.difficulty}
      gameMode: ${config.spec.gameConfig.gameplay.gameMode}
      pvpEnabled: ${config.spec.gameConfig.gameplay.pvpEnabled}
      friendlyFire: ${config.spec.gameConfig.gameplay.friendlyFire}
    performance:
      tickRate: ${config.spec.gameConfig.performance.tickRate}
      autoSave: ${config.spec.gameConfig.performance.autoSave}
      saveInterval: ${config.spec.gameConfig.performance.saveInterval}
    admin:
      adminPassword: "${config.spec.gameConfig.admin.adminPassword}"
      enableRemoteConsole: ${config.spec.gameConfig.admin.enableRemoteConsole}
      enableLogging: ${config.spec.gameConfig.admin.enableLogging}
  resources:
    cpu: ${config.spec.resources.cpu}
    memory: ${config.spec.resources.memory}
    storage: ${config.spec.resources.storage}`;
}

function copyYAMLToClipboard() {
    const yamlContent = document.querySelector('#yaml-content code').textContent;
    navigator.clipboard.writeText(yamlContent).then(() => {
        showNotification('YAML copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy to clipboard', 'error');
    });
}

// Form submission handler
async function submitGameServerForm(form) {
    const formData = new FormData(form);
    
    // Build server configuration from form data (reuse the same function as preview)
    const fullConfig = buildServerConfig(formData);
    
    // Extract just the spec for the API call (API expects the internal format)
    const serverConfig = {
        metadata: fullConfig.metadata,
        spec: fullConfig.spec
    };

    try {
        const response = await api.createServer(serverConfig);
        showNotification(`Server ${serverConfig.metadata.name} created successfully!`, 'success');
        
        // Redirect to servers page after a short delay
        setTimeout(() => {
            window.location.href = '/servers/';
        }, 1500);
        
    } catch (error) {
        showNotification(`Failed to create server: ${error.message}`, 'error');
        throw error;
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Game-specific configuration
function updateGameSpecificFields(gameType) {
    const gameSpecificSection = document.getElementById('game-specific-config');
    if (!gameSpecificSection) return;

    // Hide all game-specific sections and remove required attributes
    gameSpecificSection.querySelectorAll('.game-config').forEach(section => {
        section.style.display = 'none';
        // Remove required attribute from all fields in hidden sections
        section.querySelectorAll('[required]').forEach(field => {
            field.removeAttribute('required');
        });
    });

    // Show the selected game's configuration and restore required attributes
    const selectedGameSection = document.getElementById(`${gameType}-config`);
    if (selectedGameSection) {
        selectedGameSection.style.display = 'block';
        
        // Re-add required attributes for visible sections based on game type
        if (gameType === 'vh') {
            // Valheim requires server password
            const passwordField = selectedGameSection.querySelector('input[name="serverPassword"]');
            if (passwordField) {
                passwordField.setAttribute('required', 'required');
            }
        }
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Update dashboard stats on homepage
    if (document.getElementById('running-servers')) {
        updateDashboardStats();
        // Refresh stats every 30 seconds
        setInterval(updateDashboardStats, 30000);
    }

    // Load servers table on servers page
    if (document.getElementById('servers-tbody')) {
        loadServersTable();
        // Refresh servers every 30 seconds
        setInterval(() => loadServersTable(), 30000);
    }

    // Form submission handling - only on create page
    const gameServerForm = document.getElementById('gameserver-form');
    if (gameServerForm) {
        gameServerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = this.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating...';
            
            try {
                await submitGameServerForm(this);
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });

        // Game type change handler - only if form exists
        const gameTypeSelect = document.querySelector('select[name="gameType"]');
        if (gameTypeSelect) {
            gameTypeSelect.addEventListener('change', function() {
                updateGameSpecificFields(this.value);
            });
            
            // Initialize with current selection
            if (gameTypeSelect.value) {
                updateGameSpecificFields(gameTypeSelect.value);
            }
        }
    }
});