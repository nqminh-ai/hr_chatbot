param(
    [switch]$Full,
    [switch]$Pause
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$python = Join-Path $repoRoot '.venv\Scripts\python.exe'
$privateReport = Join-Path $repoRoot 'docs\evidence\private_test_results.json'

function Stop-WithMessage([string]$Message) {
    Write-Host "`nERROR: $Message" -ForegroundColor Red
    if ($Pause) { Read-Host 'Nhan Enter de dong' | Out-Null }
    exit 2
}

function Invoke-CheckedStep {
    param(
        [string]$Title,
        [string]$Command,
        [string[]]$Arguments,
        [string]$WorkingDirectory = $repoRoot
    )

    Write-Host "`n============================================================" -ForegroundColor DarkGray
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor DarkGray
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Title failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath $python)) {
    Stop-WithMessage "Khong tim thay Python tai $python"
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Stop-WithMessage 'Khong tim thay npm.cmd trong PATH.'
}

$startedAt = Get-Date
Write-Host 'MISSION 3 - B5 SOURCE VERIFICATION TESTS' -ForegroundColor Green
Write-Host "Commit: $(& git -C $repoRoot rev-parse --short HEAD)"
Write-Host "Started: $($startedAt.ToString('yyyy-MM-dd HH:mm:ss'))"

try {
    Invoke-CheckedStep `
        -Title '1/3 Mission 3: B5 + edge case + regression + temporal boundary' `
        -Command $python `
        -Arguments @('-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_mission3.py', '-v')

    Invoke-CheckedStep `
        -Title '2/3 Private scenarios' `
        -Command $python `
        -Arguments @(
            '-B', 'run_tests.py',
            '--db', 'data/appota.db',
            '--cases', 'tests/private_test_cases.json',
            '--report', $privateReport
        )

    Invoke-CheckedStep `
        -Title '3/3 UI acceptance test for B5' `
        -Command 'npm.cmd' `
        -Arguments @('run', 'test:ui', '--', '-t', 'B5 lets users verify') `
        -WorkingDirectory (Join-Path $repoRoot 'frontend')

    if ($Full) {
        Invoke-CheckedStep `
            -Title 'FULL GATE: coverage + scenarios + contracts + UI + lint + build' `
            -Command 'npm.cmd' `
            -Arguments @('--prefix', 'frontend', 'run', 'verify')
    }
}
catch {
    Write-Host "`nMISSION 3 TEST RESULT: FAIL" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($Pause) { Read-Host 'Nhan Enter de dong' | Out-Null }
    exit 1
}

$elapsed = (Get-Date) - $startedAt
Write-Host "`n============================================================" -ForegroundColor DarkGray
Write-Host 'MISSION 3 TEST RESULT: PASS' -ForegroundColor Green
Write-Host 'Required evidence: B5 + edge + regression = PASS'
Write-Host 'Private scenarios: PASS'
Write-Host 'B5 UI verification: PASS'
if ($Full) { Write-Host 'Full verification gate: PASS' }
Write-Host "Elapsed: $([math]::Round($elapsed.TotalSeconds, 1)) seconds"
Write-Host "Private report: $privateReport"
Write-Host "============================================================" -ForegroundColor DarkGray

if ($Pause) { Read-Host 'Nhan Enter de dong' | Out-Null }
