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
            // Transform the form data to match our API format
            const apiRequest = {
                apiVersion: 'gameplane.kubelize.io/v1alpha1',
                kind: 'GameServer',
                metadata: {
                    name: serverConfig.metadata.name,
                    namespace: serverConfig.metadata.namespace || 'default',
                },
                spec: {
                    gameType: serverConfig.spec.gameType,
                    serverName: serverConfig.spec.serverName,
                    serverDescription: serverConfig.spec.serverDescription,
                    resources: serverConfig.spec.resources,
                    networking: serverConfig.spec.networking,
                    gameConfig: serverConfig.spec.gameConfig || {},
                    autoRestart: serverConfig.spec.autoRestart !== false,
                    enableBackups: serverConfig.spec.enableBackups !== false,
                }
            };

            const response = await fetch(`${this.baseURL}/gameservers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(apiRequest),
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
            const response = await fetch(`${this.baseURL}/gameservers/${name}?namespace=${namespace}`, {
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
            const response = await fetch(`${this.baseURL}/gameservers/${name}/restart?namespace=${namespace}`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to restart server');
            return await response.json();
        } catch (error) {
            console.error('Error restarting server:', error);
            throw error;
        }
    }
}

// Initialize API instance
const api = new GamePlaneAPI();

// Utility functions
function formatBytes(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function timeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

function getStatusBadge(status) {
    const statusClasses = {
        'Running': 'bg-success',
        'Pending': 'bg-warning',
        'Failed': 'bg-danger',
        'Terminating': 'bg-secondary'
    };
    return `<span class="badge ${statusClasses[status] || 'bg-secondary'}">${status}</span>`;
}

function getGameTypeBadge(gameType) {
    const gameTypes = {
        'sdtd': { name: '7 Days to Die', class: 'bg-info' },
        'vh': { name: 'Valheim', class: 'bg-success' },
        'pw': { name: 'Palworld', class: 'bg-warning' },
        'ce': { name: 'Conan Exiles', class: 'bg-danger' },
        'we': { name: 'Whatever', class: 'bg-secondary' },
        'ln': { name: 'Linux', class: 'bg-dark' }
    };
    const game = gameTypes[gameType] || { name: gameType, class: 'bg-secondary' };
    return `<span class="badge ${game.class}">${game.name}</span>`;
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Dashboard functions
async function updateDashboardStats() {
    try {
        const servers = await api.fetchServers();
        
        const runningServers = servers.filter(s => s.status?.phase === 'Running').length;
        const totalServers = servers.length;
        const totalPlayers = servers.reduce((sum, s) => sum + (s.status?.playersOnline || 0), 0);

        // Update stat cards
        const runningElement = document.getElementById('running-servers');
        const totalElement = document.getElementById('total-servers');
        const playersElement = document.getElementById('total-players');
        
        if (runningElement) runningElement.textContent = runningServers;
        if (totalElement) totalElement.textContent = totalServers;
        if (playersElement) playersElement.textContent = totalPlayers;

        // Update recent servers table
        const recentServersBody = document.getElementById('recent-servers-body');
        if (recentServersBody) {
            const recentServers = servers.slice(0, 5);
            recentServersBody.innerHTML = recentServers.map(server => `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="fas fa-server text-primary me-2"></i>
                            <div>
                                <div class="fw-bold">${server.metadata.name}</div>
                                <small class="text-muted">${server.spec.serverName || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>${getGameTypeBadge(server.spec.gameType)}</td>
                    <td>${getStatusBadge(server.status?.phase || 'Unknown')}</td>
                    <td class="text-center">${server.status?.playersOnline || 0}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
    }
}

// Servers page functions
async function loadServersTable() {
    const loadingElement = document.getElementById('servers-loading');
    const errorElement = document.getElementById('servers-error');
    const emptyElement = document.getElementById('servers-empty');
    const tableContainer = document.getElementById('servers-table-container');
    const tbody = document.getElementById('servers-tbody');

    if (!tbody) return;

    // Show loading state
    if (loadingElement) loadingElement.classList.remove('d-none');
    if (errorElement) errorElement.classList.add('d-none');
    if (emptyElement) emptyElement.classList.add('d-none');
    if (tableContainer) tableContainer.classList.add('d-none');

    try {
        const servers = await api.fetchServers();

        // Hide loading state
        if (loadingElement) loadingElement.classList.add('d-none');

        if (servers.length === 0) {
            // Show empty state
            if (emptyElement) emptyElement.classList.remove('d-none');
        } else {
            // Show servers table
            if (tableContainer) tableContainer.classList.remove('d-none');
            populateServersTable(servers);
        }
    } catch (error) {
        console.error('Error loading servers:', error);
        // Hide loading state and show error
        if (loadingElement) loadingElement.classList.add('d-none');
        if (errorElement) errorElement.classList.remove('d-none');
    }
}

function populateServersTable(servers) {
    const tbody = document.getElementById('servers-tbody');
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
                            <small class="text-muted">${server.spec.serverDescription || server.spec.serverName || ''}</small>
                        </div>
                    </div>
                </td>
                <td>${getGameTypeBadge(server.spec.gameType)}</td>
                <td>${getStatusBadge(server.status?.phase || 'Unknown')}</td>
                <td>
                    <div class="text-center">
                        <span class="fw-bold">${server.status?.playersOnline || 0}</span>/${server.spec.gameConfig?.maxPlayers || 'N/A'}
                        <br>
                        <small class="text-muted">players</small>
                    </div>
                </td>
                <td>
                    <small>
                        <i class="fas fa-microchip"></i> ${resources.cpu || 'N/A'}<br>
                        <i class="fas fa-memory"></i> ${resources.memory || 'N/A'}<br>
                        <i class="fas fa-hdd"></i> ${resources.storageSize || 'N/A'}
                    </small>
                </td>
                <td>
                    <small>${createdDate.toLocaleDateString()}<br>${createdDate.toLocaleTimeString()}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary" 
                                onclick="showServerDetails('${server.metadata.name}', '${server.metadata.namespace || 'default'}')"
                                data-bs-toggle="tooltip" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button type="button" class="btn btn-outline-warning"
                                onclick="restartServer('${server.metadata.name}', '${server.metadata.namespace || 'default'}')"
                                data-bs-toggle="tooltip" title="Restart">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger"
                                onclick="confirmDeleteServer('${server.metadata.name}', '${server.metadata.namespace || 'default'}')"
                                data-bs-toggle="tooltip" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Initialize tooltips
    const tooltips = tbody.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
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
    const nameElement = document.getElementById('delete-server-name');
    const confirmButton = document.getElementById('confirm-delete');
    
    if (nameElement) nameElement.textContent = name;
    
    // Remove existing event listeners and add new one
    const newConfirmButton = confirmButton.cloneNode(true);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
    
    newConfirmButton.addEventListener('click', async function() {
        await deleteServer(name, namespace);
        bootstrap.Modal.getInstance(modal).hide();
    });
    
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

// Form submission handler
async function submitGameServerForm(form) {
    const formData = new FormData(form);
    
    // Build server configuration from form data
    const serverConfig = {
        metadata: {
            name: formData.get('serverName'),
            namespace: formData.get('namespace') || 'default',
        },
        spec: {
            gameType: formData.get('gameType'),
            serverName: formData.get('displayName') || formData.get('serverName'),
            serverDescription: formData.get('description') || '',
            resources: {
                cpu: formData.get('cpu'),
                memory: formData.get('memory'),
                storageSize: formData.get('storage'),
                storageClass: 'default', // You can make this configurable if needed
            },
            networking: {
                serviceType: formData.get('serviceType'),
                enableIngress: false, // You can make this configurable if needed
            },
            gameConfig: {},
        }
    };

    // Add game-specific configuration
    const gameType = formData.get('gameType');
    switch(gameType) {
        case 'sdtd':
            serverConfig.spec.gameConfig = {
                server: {
                    maxPlayers: parseInt(formData.get('maxPlayers')) || 8,
                    region: 'NorthAmericaEast',
                    serverPassword: formData.get('serverPassword') || '',
                },
                world: {
                    worldName: formData.get('worldName') || 'Navezgane',
                    worldGenSeed: '',
                    worldGenSize: 4096,
                },
                gameplay: {
                    gameDifficulty: parseInt(formData.get('difficulty')) || 1,
                    dayNightLength: 60,
                    dayLightLength: 18,
                    zombieSpawnMode: 'Walk',
                    bloodMoonFrequency: 7,
                    bloodMoonRange: 0,
                },
                performance: {
                    maxSpawnedZombies: 64,
                    maxSpawnedAnimals: 50,
                    serverMaxAllowedViewDistance: 12,
                    maxChunkAge: 5,
                },
                pvp: {
                    playerKillingMode: 0, // No killing
                    playerDamageMultiplier: 1.0,
                    zombieDamageMultiplier: 1.0,
                    blockDamagePlayer: 1.0,
                },
                admin: {
                    webControlEnabled: true,
                    webControlPort: 8080,
                    enableMapRendering: true,
                    telnetEnabled: true,
                    telnetPort: 8081,
                }
            };
            break;
        case 'valheim':
            serverConfig.spec.gameConfig = {
                server: {
                    maxPlayers: parseInt(formData.get('maxPlayers')) || 10,
                    serverPassword: formData.get('serverPassword') || '',
                },
                world: {
                    worldName: formData.get('worldName') || 'Dedicated',
                },
            };
            break;
        case 'palworld':
            serverConfig.spec.gameConfig = {
                server: {
                    maxPlayers: parseInt(formData.get('maxPlayers')) || 32,
                    serverPassword: formData.get('serverPassword') || '',
                },
            };
            break;
        case 'conan-exiles':
            serverConfig.spec.gameConfig = {
                server: {
                    maxPlayers: parseInt(formData.get('maxPlayers')) || 10,
                    serverPassword: formData.get('serverPassword') || '',
                },
                pvp: {
                    pvpEnabled: formData.get('pvpEnabled') === 'true',
                },
            };
            break;
    }

    try {
        const result = await api.createServer(serverConfig);
        
        // Show success message
        showNotification('Server created successfully!', 'success');
        
        // Redirect to servers page after a short delay
        setTimeout(() => {
            window.location.href = '/servers/';
        }, 2000);
        
    } catch (error) {
        console.error('Error creating server:', error);
        showNotification(`Failed to create server: ${error.message}`, 'error');
    }
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

// Debug function
function debugPage() {
    console.log('Debugging page elements:');
    console.log('- gameserver-form:', document.getElementById('gameserver-form'));
    console.log('- submit button:', document.querySelector('button[type="submit"]'));
    console.log('- all forms:', document.querySelectorAll('form'));
    console.log('- all buttons:', document.querySelectorAll('button'));
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    debugPage();
    
    // Update dashboard stats on homepage
    if (document.getElementById('running-servers')) {
        console.log('Found dashboard elements, updating stats');
        updateDashboardStats();
        // Refresh stats every 30 seconds
        setInterval(updateDashboardStats, 30000);
    }

    // Load servers table on servers page
    if (document.getElementById('servers-tbody')) {
        console.log('Found servers table, loading data');
        loadServersTable();
        // Refresh servers every 30 seconds
        setInterval(() => loadServersTable(), 30000);
    }

    // Form submission handling
    const gameServerForm = document.getElementById('gameserver-form');
    if (gameServerForm) {
        console.log('Found gameserver form, attaching event listener');
        gameServerForm.addEventListener('submit', async function(e) {
            console.log('Form submit event triggered');
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
    } else {
        console.log('gameserver-form not found');
    }

    // Game type change handler
    const gameTypeSelect = document.querySelector('select[name="gameType"]');
    if (gameTypeSelect) {
        console.log('Found game type select, attaching change handler');
        gameTypeSelect.addEventListener('change', function() {
            console.log('Game type changed to:', this.value);
            updateGameSpecificFields(this.value);
        });
        
        // Initialize with current selection
        if (gameTypeSelect.value) {
            console.log('Initializing with game type:', gameTypeSelect.value);
            updateGameSpecificFields(gameTypeSelect.value);
        }
    } else {
        console.log('gameType select not found');
    }

    // Debug: Add direct button click handler
    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
        console.log('Found submit button, attaching direct click handler');
        submitButton.addEventListener('click', function(e) {
            console.log('Submit button clicked directly');
        });
    } else {
        console.log('Submit button not found');
    }
});
