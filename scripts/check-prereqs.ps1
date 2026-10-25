# Read-only prerequisite check. Installs nothing and changes no system settings.
$ErrorActionPreference = 'Continue'
function Check($name, $cmd, $args_, $min) {
  $c = Get-Command $cmd -ErrorAction SilentlyContinue
  if (-not $c) { Write-Host "[MISSING] $name" -ForegroundColor Red; return }
  $v = (& $cmd $args_ 2>&1 | Select-Object -First 1)
  Write-Host "[OK] $name : $v  (required: $min)" -ForegroundColor Green
}
Check 'Node.js'    'node' '--version' '>= 20'
Check 'npm'        'npm'  '--version' '>= 10'
Check 'Git'        'git'  '--version' 'any'
Check 'PostgreSQL (psql)' 'psql' '--version' '>= 14'
if (-not (Test-Path (Join-Path $PSScriptRoot '..\.env'))) { Write-Host '[MISSING] .env  (run: Copy-Item .env.example .env)' -ForegroundColor Yellow } else { Write-Host '[OK] .env exists' -ForegroundColor Green }
