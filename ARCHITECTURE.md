# Crossplane GameServer Parent-Child Architecture

This implementation uses a sophisticated **parent-child composition pattern** similar to HashiCorp Vault's secret engine architecture. This provides superior separation of concerns, maintainability, and game-specific optimization.

## Architecture Overview

```
GameServer (User API)
    ↓
XGameServer (Parent Composite)
    ↓ (Routes based on gameType)
XSDTDGameServer | XCEGameServer | XPWGameServer | XVHGameServer | ...
    ↓ (Game-specific logic)
Kubernetes Resources (Namespace, Deployment, Services, etc.)
```

## Why Parent-Child Architecture?

### Benefits over Monolithic Composition

| Aspect | Monolithic | Parent-Child |
|--------|------------|--------------|
| **Maintainability** | Complex conditional logic | Clean separation per game |
| **Game-specific Features** | Limited by common denominator | Full game-specific schemas |
| **Validation** | Generic validation | Game-specific validation |
| **Extensibility** | Modify large composition | Add new child compositions |
| **Debugging** | Hard to isolate game issues | Clear game-specific boundaries |
| **Team Ownership** | Single team owns everything | Game teams own their compositions |

### Technical Advantages

1. **Type Safety**: Each game has its own strongly-typed configuration schema
2. **Game-Specific Defaults**: SDTD defaults to 4 CPU cores, Valheim to 2 CPU cores
3. **Port Management**: Automatic port allocation per game type
4. **Resource Optimization**: Game-specific resource requirements and limits
5. **Feature Isolation**: SDTD web admin vs Valheim's lack thereof

## Component Structure

### Parent Layer (`/crossplane/`)

#### `xrd-gameserver-parent.yaml`
- **Purpose**: High-level user API
- **Responsibilities**: Route to appropriate child based on `gameType`
- **Schema**: Common fields + flexible `gameConfig` object

#### `composition-gameserver-parent.yaml`
- **Purpose**: Routing logic using `function-go-templating`
- **Logic**: Creates game-specific composite (e.g., `XSDTDGameServer`)
- **Functions**: Uses all three pipeline functions for routing and status aggregation

### Child Layer (`/crossplane/games/*/`)

#### Game-Specific XRDs
- **SDTD**: `games/sdtd/xrd-sdtd-gameserver.yaml`
- **Conan Exiles**: `games/ce/xrd-ce-gameserver.yaml` (to be created)
- **Palworld**: `games/pw/xrd-pw-gameserver.yaml` (to be created)

Each child XRD provides:
- **Game-specific configuration schema**
- **Proper validation and defaults**
- **Game-specific status fields**
- **Connection secrets management**

#### Game-Specific Compositions
- **SDTD**: `games/sdtd/composition-sdtd-gameserver.yaml`
- **Detailed resource generation** with game-specific optimizations
- **Port configurations** (SDTD: 26900 + 26901 TCP/UDP)
- **Performance tuning** based on game requirements
- **Health checks** tailored to game startup patterns

## SDTD Example Deep Dive

### SDTD-Specific Features

```yaml
gameConfig:
  world:
    worldGenSeed: "HardcoreZombie2024"
    worldGenSize: 10240  # 10km x 10km world
    worldName: "Navezgane"
  
  gameplay:
    gameDifficulty: 4    # Survivalist
    dayNightLength: 120  # 2-hour real days
    zombieSpawnMode: "Run"
    bloodMoonFrequency: 5
  
  performance:
    maxSpawnedZombies: 128
    serverMaxAllowedViewDistance: 10
  
  pvp:
    playerKillingMode: 3  # PvP enabled
    playerDamageMultiplier: 1.5
    zombieDamageMultiplier: 2.0
  
  admin:
    webControlEnabled: true
    enableMapRendering: true
    telnetEnabled: true
```

### Generated Resources

The SDTD child composition creates:
- **Namespace**: Isolated environment
- **ConfigMap**: SDTD-specific server configuration
- **Secrets**: Server password + web control password
- **PVC**: Game save data storage
- **Deployment**: 
  - SDTD container with specific resource requirements
  - Multiple ports: 26900/26901 (TCP/UDP)
  - Proper liveness/readiness probes for SDTD startup time
- **Services**: Game service (LoadBalancer) + Web service (ClusterIP)
- **Ingress**: Web control panel with basic auth

## Usage Examples

### Simple SDTD Server
```yaml
apiVersion: kubelize.io/v1alpha1
kind: 
metadata:
  name: simple-zombie-server
spec:
  gameType: sdtd
  serverName: "Simple Zombie Server"
  common:
    maxPlayers: 8
    # Everything else uses SDTD-optimized defaults
```

### Advanced SDTD Configuration
```yaml
apiVersion: kubelize.io/v1alpha1
kind: GameServer
metadata:
  name: hardcore-zombie-server
spec:
  gameType: sdtd
  serverName: "Hardcore Zombie Apocalypse"
  common:
    maxPlayers: 16
    resources:
      cpu: "6"
      memory: "12Gi"
      storageSize: "100Gi"
  gameConfig:
    gameplay:
      gameDifficulty: 4
      zombieSpawnMode: "Run"
      bloodMoonFrequency: 5
    pvp:
      playerKillingMode: 3
      zombieDamageMultiplier: 2.0
```

## Implementation Status

### ✅ Completed
- [x] Parent XRD and Composition
- [x] SDTD Child XRD and Composition
- [x] Example configurations
- [x] Documentation

### 🚧 To Be Created
- [ ] Conan Exiles child composition (`games/ce/`)
- [ ] Palworld child composition (`games/pw/`)
- [ ] Valheim child composition (`games/vh/`)
- [ ] Other game types (`we`, `ln`)

## Installation

1. **Install Parent Components**:
   ```bash
   kubectl apply -f crossplane/xrd-gameserver-parent.yaml
   kubectl apply -f crossplane/composition-gameserver-parent.yaml
   ```

2. **Install Game-Specific Components**:
   ```bash
   # SDTD
   kubectl apply -f crossplane/games/sdtd/xrd-sdtd-gameserver.yaml
   kubectl apply -f crossplane/games/sdtd/composition-sdtd-gameserver.yaml
   ```

3. **Create a Game Server**:
   ```bash
   kubectl apply -f crossplane/examples/sdtd-hardcore-server.yaml
   ```

## Monitoring

```bash
# Check parent GameServer
kubectl get gameservers

# Check child SDTD resource
kubectl get xsdtdgameservers

# Check generated Kubernetes resources
kubectl get all -n hardcore-zombie-server-gameserver
```

## Extending the Architecture

### Adding a New Game Type

1. **Create child directory**: `crossplane/games/newgame/`
2. **Define child XRD**: Game-specific configuration schema
3. **Create child composition**: Game-specific resource generation
4. **Update parent XRD**: Add game type to enum
5. **Update parent composition**: Add routing logic for new game
6. **Create examples**: Demonstrate game-specific features

### Example: Adding Minecraft

```bash
mkdir -p crossplane/games/minecraft
```

Create `xrd-minecraft-gameserver.yaml` with Minecraft-specific fields:
```yaml
gameConfig:
  world:
    seed: string
    gamemode: enum[survival, creative, adventure]
    difficulty: enum[peaceful, easy, normal, hard]
  server:
    motd: string
    maxBuildHeight: integer
    spawnProtection: integer
    allowFlight: boolean
    enableCommandBlock: boolean
```

This architecture scales beautifully - each new game type is completely isolated with its own schema, validation, defaults, and resource generation logic.

## Best Practices

1. **Game-Specific Defaults**: Set sensible defaults for each game in the child XRD
2. **Resource Requirements**: Tune CPU/memory defaults based on game performance characteristics
3. **Port Management**: Use consistent port ranges per game type
4. **Health Checks**: Configure probes based on game startup and readiness patterns
5. **Storage**: Set appropriate default storage sizes based on game save file sizes
6. **Security**: Game-specific secret management and access controls

This parent-child architecture provides the technical excellence you're looking for while maintaining clean separation of concerns and excellent extensibility.
