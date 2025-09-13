package main

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// listNamespaces returns all available namespaces
func (s *Server) listNamespaces(c *gin.Context) {
	namespaces, err := s.kubeClient.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list namespaces",
		})
		return
	}

	// Filter to relevant namespaces or return all
	result := make([]string, 0, len(namespaces.Items))
	for _, ns := range namespaces.Items {
		result = append(result, ns.Name)
	}

	c.JSON(http.StatusOK, gin.H{
		"namespaces": result,
	})
}

// getClusterInfo returns basic cluster information
func (s *Server) getClusterInfo(c *gin.Context) {
	// Get cluster version
	version, err := s.kubeClient.Discovery().ServerVersion()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get cluster version",
		})
		return
	}

	// Get node count
	nodes, err := s.kubeClient.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get nodes",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"version":   version.String(),
		"nodeCount": len(nodes.Items),
		"platform":  version.Platform,
	})
}
