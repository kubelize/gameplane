package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

// Server represents the API server
type Server struct {
	k8sClient   client.Client
	kubeClient  kubernetes.Interface
	router      *gin.Engine
	port        string
}

// NewServer creates a new API server instance
func NewServer() (*Server, error) {
	// Create Kubernetes client
	config, err := getKubernetesConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	// Create controller-runtime client for custom resources
	scheme := runtime.NewScheme()
	k8sClient, err := client.New(config, client.Options{Scheme: scheme})
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	// Create standard kubernetes client for core resources
	kubeClient, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes core client: %w", err)
	}

	// Setup Gin router
	router := gin.Default()
	
	// Configure CORS
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"http://localhost:1313", "http://localhost:3000"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	router.Use(cors.New(corsConfig))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &Server{
		k8sClient:  k8sClient,
		kubeClient: kubeClient,
		router:     router,
		port:       port,
	}

	server.setupRoutes()
	return server, nil
}

// getKubernetesConfig gets the Kubernetes configuration
func getKubernetesConfig() (*rest.Config, error) {
	// Try in-cluster config first
	config, err := rest.InClusterConfig()
	if err == nil {
		return config, nil
	}

	// Fall back to kubeconfig file
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		kubeconfig = os.ExpandEnv("$HOME/.kube/config")
	}

	config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		return nil, fmt.Errorf("failed to build config from kubeconfig: %w", err)
	}

	return config, nil
}

// setupRoutes configures the API routes
func (s *Server) setupRoutes() {
	api := s.router.Group("/api/v1")
	{
		// Health check
		api.GET("/health", s.healthCheck)
		
		// GameServer management
		gameservers := api.Group("/gameservers")
		{
			gameservers.GET("", s.listGameServers)
			gameservers.POST("", s.createGameServer)
			gameservers.GET("/:namespace/:name", s.getGameServer)
			gameservers.PUT("/:namespace/:name", s.updateGameServer)
			gameservers.DELETE("/:namespace/:name", s.deleteGameServer)
			gameservers.GET("/:namespace/:name/logs", s.getGameServerLogs)
			gameservers.POST("/:namespace/:name/restart", s.restartGameServer)
		}

		// Namespace management
		api.GET("/namespaces", s.listNamespaces)
		
		// Cluster info
		api.GET("/cluster/info", s.getClusterInfo)
	}

	// Serve static files (Hugo build output)
	s.router.Static("/static", "./static")
	s.router.StaticFile("/", "./public/index.html")
	s.router.NoRoute(func(c *gin.Context) {
		c.File("./public/index.html")
	})
}

// healthCheck returns the health status of the API
func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
	})
}

// Start starts the API server
func (s *Server) Start() error {
	log.Printf("Starting GamePlane API server on port %s", s.port)
	return s.router.Run(":" + s.port)
}

func main() {
	server, err := NewServer()
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	if err := server.Start(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
