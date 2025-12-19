# Research Paper RAG System - Deployment Script (PowerShell)
# Usage: .\deploy.ps1 [-Environment dev|staging|prod] [-Guided]

param(
    [Parameter()]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment = "dev",
    
    [Parameter()]
    [switch]$Guided,
    
    [Parameter()]
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Research Paper RAG System - Deployment" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Change to infrastructure directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Validate SAM CLI is installed
try {
    $samVersion = sam --version
    Write-Host "Using SAM CLI: $samVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: SAM CLI not found. Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html" -ForegroundColor Red
    exit 1
}

# Validate AWS credentials
try {
    $identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "AWS Account: $($identity.Account)" -ForegroundColor Green
    Write-Host "AWS User/Role: $($identity.Arn)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS credentials not configured. Run 'aws configure'" -ForegroundColor Red
    exit 1
}

# Build
if (-not $SkipBuild) {
    Write-Host "`n[1/3] Building SAM application..." -ForegroundColor Cyan
    sam build --template-file template.yaml
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: SAM build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "Build successful!" -ForegroundColor Green
} else {
    Write-Host "`n[1/3] Skipping build (--SkipBuild flag set)" -ForegroundColor Yellow
}

# Validate
Write-Host "`n[2/3] Validating template..." -ForegroundColor Cyan
sam validate --template-file template.yaml
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Template validation failed" -ForegroundColor Red
    exit 1
}
Write-Host "Validation successful!" -ForegroundColor Green

# Deploy
Write-Host "`n[3/3] Deploying to AWS..." -ForegroundColor Cyan

if ($Guided) {
    sam deploy --guided --config-env $Environment
} else {
    sam deploy --config-env $Environment --no-confirm-changeset
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# Get outputs
Write-Host "`nStack Outputs:" -ForegroundColor Yellow
$stackName = "research-paper-rag-$Environment"
aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs" --output table

