$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:5000/api"

Write-Host "Checking ASTRERO Flask API..." -ForegroundColor Cyan
$traffic = Invoke-RestMethod "$base/traffic-status"
$wave = Invoke-RestMethod "$base/green-wave"
$savings = Invoke-RestMethod "$base/savings"
$mode = Invoke-RestMethod "$base/toggle-mode"

Write-Host "Traffic junctions: $($traffic.junctions.Count) | Mode: $($traffic.mode)" -ForegroundColor Green
Write-Host "Green-wave offsets: $(($wave.junctions.offset_seconds -join ', ')) seconds" -ForegroundColor Green
Write-Host "Fuel saved: $($savings.fuel_saved_liters) L | CO2 saved: $($savings.co2_saved_kg) kg" -ForegroundColor Green
Write-Host "AI mode: $($mode.mode)" -ForegroundColor Green
