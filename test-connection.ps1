$headers = @{
    "X-Dev-Bypass" = "1"
    "Content-Type" = "application/json"
}

Write-Host "Testing localhost connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/admin/dashboard" -Headers $headers -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Localhost works! Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ Localhost failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTesting network IP (192.168.1.9) connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://192.168.1.9:5000/api/admin/dashboard" -Headers $headers -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Network IP works! Status: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "✗ Network IP failed: $($_.Exception.Message)" -ForegroundColor Red
}
