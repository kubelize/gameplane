# Crossplane GameServer Hybrid Architecture

This directory contains a complete Crossplane-based solution for managing game servers using a hybrid approach that leverages your existing container images and Kubernetes resources.

## Architecture Overview

### Components

1. **XRD (CompositeResourceDefinition)**: `xrd-gameserver.yaml`
   - Defines the high-level GameServer API
   - Supports 6 game types: sdtd, ce, pw, vh, we, ln
   - Comprehensive configuration options for resources, networking, and advanced settings

2. **Composition**: `composition-gameserver.yaml` 
   - Pipeline-based composition using your installed functions
   - Generates all necessary Kubernetes resources
   - Game-specific port and configuration patching

3. **Examples**: Various GameServer examples demonstrating different use cases

### Technical Features

#### Pipeline Functions Used
- **function-go-templating**: Generates base Kubernetes resources with dynamic configuration
- **function-patch-and-transform**: Applies game-specific patches (ports, configurations)
- **function-auto-ready**: Manages resource readiness and status updates

#### Generated Resources Per GameServer
- **Namespace**: Isolated environment for each game server
- **ConfigMap**: Server configuration and game-specific settings
- **Secrets**: Auto-generated server and admin passwords (or use provided ones)
- **PersistentVolumeClaim**: Game data storage
- **Deployment**: Game server container with your existing images
- **Services**: Game port and web admin services
- **Ingress**: Optional web admin access (when enabled)

#### Game-Specific Configurations
| Game Type | Game Port | Web Port | Image Tag |
|-----------|-----------|----------|-----------|
| sdtd      | 26900     | 8080     | 0.2.9-sdtd |
| ce        | 7777      | 27015    | 0.2.9-ce   |
| pw        | 8211      | 8212     | 0.2.9-pw   |
| vh        | 2456      | 2457     | 0.2.9-vh   |
| we        | 15777     | 15778    | 0.2.9-we   |
| ln        | 25565     | 25566    | 0.2.9-ln   |

## Usage Examples

### Simple Server (Minimal Configuration)
```bash
kubectl apply -f examples/simple-server.yaml
```

### Game-Specific Servers
```bash
# Seven Days to Die with custom configuration
kubectl apply -f examples/sdtd-server.yaml

# Conan Exiles with PvP settings
kubectl apply -f examples/conan-exiles-server.yaml

# Palworld cooperative server
kubectl apply -f examples/palworld-server.yaml

# Valheim with custom world
kubectl apply -f examples/valheim-server.yaml
```

### High-Performance Tournament Server
```bash
kubectl apply -f examples/high-performance-server.yaml
```

## Installation

1. **Install the XRD**:
   ```bash
   kubectl apply -f xrd-gameserver.yaml
   ```

2. **Install the Composition**:
   ```bash
   kubectl apply -f composition-gameserver.yaml
   ```

3. **Create a GameServer**:
   ```bash
   kubectl apply -f examples/simple-server.yaml
   ```

## Monitoring and Management

### Check GameServer Status
```bash
# List all game servers
kubectl get gameservers

# Get detailed status
kubectl describe gameserver simple-zombie-server

# Check generated resources
kubectl get all -n simple-zombie-server-gameserver
```

### Connect to Your Server
```bash
# Get server connection details
kubectl get gameserver simple-zombie-server -o jsonpath='{.status.serverEndpoint}'

# Get auto-generated passwords
kubectl get secret simple-zombie-server-server-password -n simple-zombie-server-gameserver -o jsonpath='{.data.ServerPassword}' | base64 -d
```

### Access Web Admin (if enabled)
```bash
# Port-forward to web admin
kubectl port-forward -n simple-zombie-server-gameserver svc/simple-zombie-server-web-service 8080:8080

# Or use ingress if configured
curl https://sdtd-admin.yourdomain.com
```

## Advanced Features

### Custom Resource Allocation
```yaml
resources:
  cpu: "8"           # 8 CPU cores
  memory: "16Gi"     # 16GB RAM
  storageSize: "100Gi"  # 100GB storage
  storageClass: "fast-ssd"  # Custom storage class
```

### Node Scheduling
```yaml
advanced:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: node-type
            operator: In
            values: ["gaming-optimized"]
  tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "gaming"
    effect: "NoSchedule"
```

### Custom Environment Variables
```yaml
advanced:
  customEnvVars:
    DIFFICULTY: "5"
    PVP_ENABLED: "true"
    CUSTOM_SETTING: "value"
```

### Backup Configuration
```yaml
advanced:
  backupEnabled: true
  backupSchedule: "0 2 * * *"  # Daily at 2 AM
```

## Benefits of This Approach

1. **Resource-Level Control**: Each Kubernetes resource is explicitly managed
2. **Game-Specific Optimization**: Automatic port and configuration management per game type
3. **Scalability**: Easy to add new game types or modify existing ones
4. **Observability**: Full visibility into all generated resources
5. **Security**: Isolated namespaces and auto-generated secrets
6. **Flexibility**: Supports everything from simple to high-performance configurations
7. **GitOps Ready**: Declarative configuration fits perfectly with GitOps workflows

## Extending the Architecture

### Adding New Game Types
1. Update the XRD enum in `xrd-gameserver.yaml`
2. Add game-specific port mappings in the composition
3. Build and tag your game container image
4. Create example configurations

### Adding New Features
The pipeline architecture makes it easy to add new capabilities:
- Add new steps to the pipeline in `composition-gameserver.yaml`
- Use additional Crossplane functions for complex logic
- Extend the XRD schema for new configuration options

This hybrid approach gives you the best of both worlds: the power and flexibility of Crossplane with the proven reliability of your existing container-based game server solution.
