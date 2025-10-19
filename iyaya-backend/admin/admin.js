document.addEventListener('DOMContentLoaded', () => {
    // Initial data load
    fetchData();
    
    // Add refresh button event listener if it exists
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        fetchData(currentPage);
    });
});

let currentPage = 1;

async function fetchData(page = 1) {
    const container = document.getElementById('data-container');
    
    // Show loading state
    container.innerHTML = '<div class="loading">Loading providers...</div>';
    
    try {
        const response = await fetch(`/api/v1/providers?page=${page}`);
        
        // Check for HTTP errors
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        currentPage = page;
        
        // Build the table HTML
        container.innerHTML = `
            <div class="providers-header">
                <h2>Service Providers</h2>
                <button id="refresh-btn" class="refresh-btn">⟳ Refresh</button>
            </div>
            <div class="table-responsive">
                <table class="providers-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Service</th>
                            <th>Email</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(provider => `
                            <tr>
                                <td>${provider.name || 'N/A'}</td>
                                <td>${provider.service || 'N/A'}</td>
                                <td><a href="mailto:${provider.email}">${provider.email}</a></td>
                                <td><span class="status-badge ${provider.status}">${provider.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${renderPagination(data.pagination)}
        `;
        
    } catch (error) {
        console.error('Error fetching providers:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>⚠️ Failed to load providers. Please try again later.</p>
                ${process.env.NODE_ENV === 'development' ? 
                    `<div class="error-details">
                        <pre>${error.message}</pre>
                    </div>` 
                    : ''
                }
                <button onclick="fetchData()">Retry</button>
            </div>
        `;
    }
}

function renderPagination(pagination) {
    if (!pagination) return '';
    
    const { totalPages, currentPage, hasNext, hasPrev } = pagination;
    
    return `
        <div class="pagination-controls">
            <button 
                ${!hasPrev ? 'disabled' : ''} 
                onclick="fetchData(${currentPage - 1})"
            >
                ← Previous
            </button>
            
            <span class="page-info">
                Page ${currentPage} of ${totalPages}
            </span>
            
            <button 
                ${!hasNext ? 'disabled' : ''} 
                onclick="fetchData(${currentPage + 1})"
            >
                Next →
            </button>
        </div>
    `;
}

// Add to window for global access
window.fetchData = fetchData;