package main

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// GameServerSpec represents the specification for a GameServer
type GameServerSpec struct {
	GameType          string                 `json:"gameType" binding:"required"`
	ServerName        string                 `json:"serverName,omitempty"`
	ServerDescription string                 `json:"serverDescription,omitempty"`
	Resources         GameServerResources    `json:"resources,omitempty"`
	Networking        GameServerNetworking   `json:"networking,omitempty"`
	GameConfig        map[string]interface{} `json:"gameConfig,omitempty"`
	Advanced          GameServerAdvanced     `json:"advanced,omitempty"`
}

// GameServerResources defines resource requirements
type GameServerResources struct {
	CPU          string `json:"cpu,omitempty"`
	Memory       string `json:"memory,omitempty"`
	StorageSize  string `json:"storageSize,omitempty"`
	StorageClass string `json:"storageClass,omitempty"`
}

// GameServerNetworking defines networking configuration
type GameServerNetworking struct {
	ServiceType    string `json:"serviceType,omitempty"`
	EnableIngress  bool   `json:"enableIngress,omitempty"`
	IngressHost    string `json:"ingressHost,omitempty"`
}

// GameServerAdvanced defines advanced configuration
type GameServerAdvanced struct {
	Affinity       map[string]interface{} `json:"affinity,omitempty"`
	Tolerations    []map[string]interface{} `json:"tolerations,omitempty"`
	CustomEnvVars  map[string]string      `json:"customEnvVars,omitempty"`
}

// GameServerStatus represents the current status of a GameServer
type GameServerStatus struct {
	Phase          string                 `json:"phase,omitempty"`
	ChildType      string                 `json:"childType,omitempty"`
	ChildName      string                 `json:"childName,omitempty"`
	ServerIP       string                 `json:"serverIP,omitempty"`
	GamePort       int                    `json:"gamePort,omitempty"`
	WebPort        int                    `json:"webPort,omitempty"`
	ServerEndpoint string                 `json:"serverEndpoint,omitempty"`
	PlayersOnline  int                    `json:"playersOnline,omitempty"`
	LastUpdate     *metav1.Time           `json:"lastUpdate,omitempty"`
	Conditions     []metav1.Condition     `json:"conditions,omitempty"`
}

// GameServerPort represents a port mapping
type GameServerPort struct {
	Name       string `json:"name"`
	Port       int32  `json:"port"`
	TargetPort int32  `json:"targetPort"`
	Protocol   string `json:"protocol"`
}

// GameServer represents a complete GameServer resource
type GameServer struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              GameServerSpec   `json:"spec,omitempty"`
	Status            GameServerStatus `json:"status,omitempty"`
}

// GameServerList represents a list of GameServers
type GameServerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []GameServer `json:"items"`
}

var (
	gameServerGVR = schema.GroupVersionResource{
		Group:    "gameplane.kubelize.io",
		Version:  "v1alpha1",
		Resource: "gameservers",
	}
)

// listGameServers returns all GameServers across namespaces
func (s *Server) listGameServers(c *gin.Context) {
	namespace := c.Query("namespace")
	if namespace == "" {
		namespace = "default"
	}

	// Create unstructured list to query custom resources
	list := &unstructured.UnstructuredList{}
	list.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "gameplane.kubelize.io",
		Version: "v1alpha1",
		Kind:    "GameServerList",
	})

	var listOpts []client.ListOption
	if namespace != "" && namespace != "all" {
		listOpts = append(listOpts, client.InNamespace(namespace))
	}

	if err := s.k8sClient.List(context.TODO(), list, listOpts...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to list GameServers: %v", err),
		})
		return
	}

	// Convert unstructured list to GameServer list
	gameServers := make([]GameServer, 0, len(list.Items))
	for _, item := range list.Items {
		gs, err := unstructuredToGameServer(&item)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to convert GameServer: %v", err),
			})
			return
		}
		gameServers = append(gameServers, *gs)
	}

	c.JSON(http.StatusOK, gin.H{
		"items": gameServers,
		"total": len(gameServers),
	})
}

// createGameServer creates a new GameServer (Crossplane Composite Resource)
func (s *Server) createGameServer(c *gin.Context) {
	var req struct {
		APIVersion string         `json:"apiVersion"`
		Kind       string         `json:"kind"`
		Metadata   metav1.ObjectMeta `json:"metadata"`
		Spec       GameServerSpec `json:"spec"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Set defaults for Crossplane Composite Resource
	if req.APIVersion == "" {
		req.APIVersion = "gameplane.kubelize.io/v1alpha1"
	}
	if req.Kind == "" {
		req.Kind = "GameServer"  // This will create a GameServer claim
	}
	if req.Metadata.Namespace == "" {
		req.Metadata.Namespace = "default"
	}

	// Validate required fields
	if req.Metadata.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "metadata.name is required",
		})
		return
	}

	if req.Spec.GameType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "spec.gameType is required",
		})
		return
	}

	// Validate gameType is supported
	validGameTypes := map[string]bool{
		"sdtd": true,
		"ce":   true,
		"pw":   true,
		"vh":   true,
		"we":   true,
		"ln":   true,
	}
	if !validGameTypes[req.Spec.GameType] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Unsupported game type: %s. Valid types: sdtd, ce, pw, vh, we, ln", req.Spec.GameType),
		})
		return
	}

	// Build the spec object for Crossplane
	spec := map[string]interface{}{
		"gameType": req.Spec.GameType,
	}

	// Add server identification
	if req.Spec.ServerName != "" {
		spec["serverName"] = req.Spec.ServerName
	}
	if req.Spec.ServerDescription != "" {
		spec["serverDescription"] = req.Spec.ServerDescription
	}

	// Add resources if provided
	if req.Spec.Resources.CPU != "" || req.Spec.Resources.Memory != "" || req.Spec.Resources.StorageSize != "" {
		resources := map[string]interface{}{}
		if req.Spec.Resources.CPU != "" {
			resources["cpu"] = req.Spec.Resources.CPU
		}
		if req.Spec.Resources.Memory != "" {
			resources["memory"] = req.Spec.Resources.Memory
		}
		if req.Spec.Resources.StorageSize != "" {
			resources["storageSize"] = req.Spec.Resources.StorageSize
		}
		if req.Spec.Resources.StorageClass != "" {
			resources["storageClass"] = req.Spec.Resources.StorageClass
		}
		spec["resources"] = resources
	}

	// Add networking if provided
	if req.Spec.Networking.ServiceType != "" || req.Spec.Networking.EnableIngress || req.Spec.Networking.IngressHost != "" {
		networking := map[string]interface{}{}
		if req.Spec.Networking.ServiceType != "" {
			networking["serviceType"] = req.Spec.Networking.ServiceType
		}
		if req.Spec.Networking.EnableIngress {
			networking["enableIngress"] = req.Spec.Networking.EnableIngress
		}
		if req.Spec.Networking.IngressHost != "" {
			networking["ingressHost"] = req.Spec.Networking.IngressHost
		}
		spec["networking"] = networking
	}

	// Add game-specific configuration
	if req.Spec.GameConfig != nil && len(req.Spec.GameConfig) > 0 {
		spec["gameConfig"] = req.Spec.GameConfig
	}

	// Add advanced configuration if provided
	if req.Spec.Advanced.Affinity != nil || len(req.Spec.Advanced.Tolerations) > 0 || len(req.Spec.Advanced.CustomEnvVars) > 0 {
		advanced := map[string]interface{}{}
		if req.Spec.Advanced.Affinity != nil {
			advanced["affinity"] = req.Spec.Advanced.Affinity
		}
		if len(req.Spec.Advanced.Tolerations) > 0 {
			advanced["tolerations"] = req.Spec.Advanced.Tolerations
		}
		if len(req.Spec.Advanced.CustomEnvVars) > 0 {
			advanced["customEnvVars"] = req.Spec.Advanced.CustomEnvVars
		}
		spec["advanced"] = advanced
	}

	// Create unstructured object for Crossplane Composite Resource Claim
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": req.APIVersion,
			"kind":       req.Kind,
			"metadata": map[string]interface{}{
				"name":      req.Metadata.Name,
				"namespace": req.Metadata.Namespace,
				"labels": map[string]interface{}{
					"app.kubernetes.io/name":        "gameserver",
					"app.kubernetes.io/instance":    req.Metadata.Name,
					"gameplane.kubelize.io/game-type": req.Spec.GameType,
				},
			},
			"spec": spec,
		},
	}

	// Add any additional labels from the request
	if req.Metadata.Labels != nil {
		metadata := obj.Object["metadata"].(map[string]interface{})
		labels := metadata["labels"].(map[string]interface{})
		for k, v := range req.Metadata.Labels {
			labels[k] = v
		}
	}

	// Create the Crossplane Composite Resource Claim
	if err := s.k8sClient.Create(context.TODO(), obj); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to create GameServer: %v", err),
		})
		return
	}

	// Convert back to structured format for response
	gameServer, err := unstructuredToGameServer(obj)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to convert created GameServer: %v", err),
		})
		return
	}

	c.JSON(http.StatusCreated, gameServer)
}

// getGameServer retrieves a specific GameServer
func (s *Server) getGameServer(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	obj := &unstructured.Unstructured{}
	obj.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "gameplane.kubelize.io",
		Version: "v1alpha1",
		Kind:    "GameServer",
	})

	key := client.ObjectKey{
		Namespace: namespace,
		Name:      name,
	}

	if err := s.k8sClient.Get(context.TODO(), key, obj); err != nil {
		if client.IgnoreNotFound(err) == nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "GameServer not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to get GameServer: %v", err),
		})
		return
	}

	gameServer, err := unstructuredToGameServer(obj)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to convert GameServer: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gameServer)
}

// updateGameServer updates an existing GameServer
func (s *Server) updateGameServer(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	var updateReq GameServerSpec
	if err := c.ShouldBindJSON(&updateReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Get existing GameServer
	obj := &unstructured.Unstructured{}
	obj.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "gameplane.kubelize.io",
		Version: "v1alpha1",
		Kind:    "GameServer",
	})

	key := client.ObjectKey{
		Namespace: namespace,
		Name:      name,
	}

	if err := s.k8sClient.Get(context.TODO(), key, obj); err != nil {
		if client.IgnoreNotFound(err) == nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "GameServer not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to get GameServer: %v", err),
		})
		return
	}

	// Update spec
	spec := map[string]interface{}{
		"gameType":          updateReq.GameType,
		"serverName":        updateReq.ServerName,
		"serverDescription": updateReq.ServerDescription,
		"resources": map[string]interface{}{
			"cpu":         updateReq.Resources.CPU,
			"memory":      updateReq.Resources.Memory,
			"storageSize": updateReq.Resources.StorageSize,
		},
		"networking": map[string]interface{}{
			"serviceType": updateReq.Networking.ServiceType,
		},
		"gameConfig":    updateReq.GameConfig,
		"autoRestart":   updateReq.AutoRestart,
		"enableBackups": updateReq.EnableBackups,
	}

	obj.Object["spec"] = spec

	if err := s.k8sClient.Update(context.TODO(), obj); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to update GameServer: %v", err),
		})
		return
	}

	gameServer, err := unstructuredToGameServer(obj)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to convert updated GameServer: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gameServer)
}

// deleteGameServer deletes a GameServer
func (s *Server) deleteGameServer(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	obj := &unstructured.Unstructured{}
	obj.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "gameplane.kubelize.io",
		Version: "v1alpha1",
		Kind:    "GameServer",
	})
	obj.SetName(name)
	obj.SetNamespace(namespace)

	if err := s.k8sClient.Delete(context.TODO(), obj); err != nil {
		if client.IgnoreNotFound(err) == nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "GameServer not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to delete GameServer: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "GameServer deleted successfully",
	})
}

// getGameServerLogs retrieves logs for a GameServer
func (s *Server) getGameServerLogs(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")
	
	lines := c.DefaultQuery("lines", "100")
	tailLines, err := strconv.ParseInt(lines, 10, 64)
	if err != nil {
		tailLines = 100
	}

	// Find pod associated with GameServer
	podList, err := s.kubeClient.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("app.kubernetes.io/instance=%s", name),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to find pods: %v", err),
		})
		return
	}

	if len(podList.Items) == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No pods found for GameServer",
		})
		return
	}

	// Get logs from the first pod
	pod := podList.Items[0]
	
	// This is a simplified implementation - in reality you'd stream the logs
	c.JSON(http.StatusOK, gin.H{
		"logs": fmt.Sprintf("Logs for GameServer %s in namespace %s (pod: %s)\nRequested %d lines\n[Log streaming not yet implemented]", name, namespace, pod.Name, tailLines),
		"pod":  pod.Name,
	})
}

// restartGameServer restarts a GameServer by deleting its pod
func (s *Server) restartGameServer(c *gin.Context) {
	namespace := c.Param("namespace")
	name := c.Param("name")

	// Find pod associated with GameServer
	podList, err := s.kubeClient.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("app.kubernetes.io/instance=%s", name),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to find pods: %v", err),
		})
		return
	}

	if len(podList.Items) == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No pods found for GameServer",
		})
		return
	}

	// Delete the pod to trigger restart
	pod := podList.Items[0]
	if err := s.kubeClient.CoreV1().Pods(namespace).Delete(context.TODO(), pod.Name, metav1.DeleteOptions{}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to restart GameServer: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("GameServer %s restarted successfully", name),
		"pod":     pod.Name,
	})
}

// unstructuredToGameServer converts an unstructured object to a GameServer
func unstructuredToGameServer(obj *unstructured.Unstructured) (*GameServer, error) {
	gs := &GameServer{
		TypeMeta: metav1.TypeMeta{
			APIVersion: obj.GetAPIVersion(),
			Kind:       obj.GetKind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              obj.GetName(),
			Namespace:         obj.GetNamespace(),
			CreationTimestamp: obj.GetCreationTimestamp(),
			Labels:            obj.GetLabels(),
			Annotations:       obj.GetAnnotations(),
		},
	}

	// Extract spec
	if spec, found, err := unstructured.NestedMap(obj.Object, "spec"); err == nil && found {
		gs.Spec.GameType, _, _ = unstructured.NestedString(spec, "gameType")
		gs.Spec.ServerName, _, _ = unstructured.NestedString(spec, "serverName")
		gs.Spec.ServerDescription, _, _ = unstructured.NestedString(spec, "serverDescription")
		gs.Spec.AutoRestart, _, _ = unstructured.NestedBool(spec, "autoRestart")
		gs.Spec.EnableBackups, _, _ = unstructured.NestedBool(spec, "enableBackups")

		if resources, found, _ := unstructured.NestedMap(spec, "resources"); found {
			gs.Spec.Resources.CPU, _, _ = unstructured.NestedString(resources, "cpu")
			gs.Spec.Resources.Memory, _, _ = unstructured.NestedString(resources, "memory")
			gs.Spec.Resources.StorageSize, _, _ = unstructured.NestedString(resources, "storageSize")
		}

		if networking, found, _ := unstructured.NestedMap(spec, "networking"); found {
			gs.Spec.Networking.ServiceType, _, _ = unstructured.NestedString(networking, "serviceType")
		}

		if gameConfig, found, _ := unstructured.NestedMap(spec, "gameConfig"); found {
			gs.Spec.GameConfig = gameConfig
		}
	}

	// Extract status
	if status, found, err := unstructured.NestedMap(obj.Object, "status"); err == nil && found {
		gs.Status.Phase, _, _ = unstructured.NestedString(status, "phase")
		gs.Status.ExternalIP, _, _ = unstructured.NestedString(status, "externalIP")
		playersOnline, _, _ := unstructured.NestedInt64(status, "playersOnline")
		gs.Status.PlayersOnline = int(playersOnline)
	}

	return gs, nil
}
