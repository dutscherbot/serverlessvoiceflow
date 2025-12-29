# Test Vercel API Endpoint
# Replace with your actual Vercel URL

$VERCEL_URL = "https://serverlessvoiceflow.vercel.app"  # Update this with your actual URL
# Alternative: $VERCEL_URL = "https://serverless-voiceflow-integration.vercel.app"

Write-Host "🔍 Testing Vercel API Endpoint..." -ForegroundColor Cyan
Write-Host "URL: $VERCEL_URL" -ForegroundColor Gray
Write-Host ""

# Test 1: Health Check (GET)
Write-Host "📊 Test 1: Health Check (GET /api/voiceflow/search)" -ForegroundColor Yellow
Write-Host "=" * 60

try {
    $healthResponse = Invoke-RestMethod -Uri "$VERCEL_URL/api/voiceflow/search" -Method GET -ErrorAction Stop
    $healthResponse | ConvertTo-Json -Depth 5
    
    if ($healthResponse.mongodb.connected) {
        Write-Host "✅ MongoDB is connected!" -ForegroundColor Green
        Write-Host "   Document count: $($healthResponse.mongodb.documentCount)" -ForegroundColor Gray
    } else {
        Write-Host "❌ MongoDB is NOT connected!" -ForegroundColor Red
        Write-Host "   Error: $($healthResponse.mongodb.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health check failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# Test 2: Search Query (POST)
Write-Host "🔍 Test 2: Search Query (POST /api/voiceflow/search)" -ForegroundColor Yellow
Write-Host "Query: 'test tube'" -ForegroundColor Gray
Write-Host "=" * 60

try {
    $body = @{
        query = "test tube"
    } | ConvertTo-Json
    
    $searchResponse = Invoke-RestMethod -Uri "$VERCEL_URL/api/voiceflow/search" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    $searchResponse | ConvertTo-Json -Depth 5
    
    if ($searchResponse.success) {
        Write-Host "✅ Search successful!" -ForegroundColor Green
        Write-Host "   Found: $($searchResponse.count) products" -ForegroundColor Gray
    } else {
        Write-Host "❌ Search failed!" -ForegroundColor Red
        Write-Host "   Message: $($searchResponse.speech)" -ForegroundColor Red
        if ($searchResponse.error) {
            Write-Host "   Error: $($searchResponse.error)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Search request failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get response body
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host ""

# Summary
Write-Host "=" * 60
Write-Host "📋 Summary" -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""
Write-Host "If MongoDB shows as disconnected:" -ForegroundColor Yellow
Write-Host "  1. Check Vercel environment variables are set correctly" -ForegroundColor Gray
Write-Host "  2. Verify MONGO_URI doesn't include 'MONGO_URI = ' prefix" -ForegroundColor Gray
Write-Host "  3. Redeploy after updating environment variables" -ForegroundColor Gray
Write-Host "  4. Check MongoDB Atlas Network Access allows 0.0.0.0/0" -ForegroundColor Gray
Write-Host ""




