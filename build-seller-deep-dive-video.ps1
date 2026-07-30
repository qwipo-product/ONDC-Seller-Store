param(
    [string]$SourcePptx = "Documents\Seller-Store-Walkthrough.pptx",
    [string]$WorkPptx   = "Documents\Seller-Store-Seller-Deep-Dive.pptx",
    [string]$OutMp4     = "Demo Videos\Seller-Store-Seller-Deep-Dive.mp4",
    [string]$Voice      = "en-IN-NeerjaNeural",
    [string]$Rate       = "+10%",
    [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"
$root = "C:\Users\Lenovo\OneDrive - Xavica Primary\Desktop\Seller Store"
Set-Location $root

$src       = Join-Path $root $SourcePptx
$work      = Join-Path $root $WorkPptx
$mp4       = Join-Path $root $OutMp4
$mp4Silent = [System.IO.Path]::ChangeExtension($mp4, $null) + ".silent.mp4"
$audioDir  = Join-Path $root "Documents\_seller_deep_dive_audio"

$python   = "C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe"
$ffmpeg   = "C:\Users\Lenovo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
$ffprobe  = "C:\Users\Lenovo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffprobe.exe"
foreach ($p in @($python, $ffmpeg, $ffprobe)) {
    if (-not (Test-Path $p)) { throw "Required tool not found: $p" }
}

$mp4Dir = Split-Path $mp4 -Parent
if (-not (Test-Path $mp4Dir))   { New-Item -ItemType Directory -Path $mp4Dir   | Out-Null }
if (-not (Test-Path $audioDir)) { New-Item -ItemType Directory -Path $audioDir | Out-Null }

# Seller-only slides from the original 31-slide deck. Skip admin (1-12) and Offers (24, 25),
# KYC (30). Cover everything the user asked for: catalog, pricing/stock sync, orders,
# customers, serviceability, ONDC connector, WhatsApp, reports.
$keep = @(13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 26, 27, 28, 29, 31)

# Conversational narration tied to the seller's perspective. Hits every point the user
# called out: B2B replica online, ONDC reach, beat-wise serviceability, bulk price sync,
# multi-distributorship customers, Tally exports, WhatsApp alerts, shop on/off, reports
# for stock and sales decisions.
$narration = @(
    "This is the seller side of the Qwipo Seller Store, built for distributors who already run a B2B delivery business. The platform is essentially the online twin of the distributor's existing offline operation - same customers, same beats, same brands, just digitized. And with one simple connector, the seller is live on the entire ONDC network, which means multiple buyer applications across the country can now see his catalog without him having to build or list anywhere else.",
    "The seller's home is built around six core areas - My SKU for the catalog, Orders for everything coming in, Customers, Offers and Schemes, Settings to configure the store, and Reports.",
    "My SKU is where the catalog lives. Every product the seller carries shows up here. Filter by brand, category or status, search by name, code or HSN. The most useful part is inline editing - change price or inventory right inside the row, without opening each SKU separately.",
    "There are three ways to grow the catalog. Add a single SKU manually when you need full control. Bulk import using a CSV template when you're onboarding hundreds of SKUs in one go. Or pull pre-validated SKUs straight from Qwipo's central master catalog, with zero data entry.",
    "Manual entry captures the full picture - identity, pricing, GST, MOQ, stock, ONDC fields. And the seller can upload multiple product images alongside the primary photo, so the listing looks rich and professional on the buyer side.",
    "For scale, bulk import processes a CSV or Excel template, runs a validation pass, flags any ONDC errors, and commits everything valid in one go. And Central Catalog Sync pulls pre-validated SKUs straight from Qwipo's master library, so the seller can skip data entry entirely.",
    "Pricing and stock are managed here. The seller can bulk-edit prices across the entire catalog - MRP, list price, GST, tier discounts. And within a fraction of a second, the updated prices and stock counts flow out to the ONDC network. Buyers always see the latest numbers in near real time.",
    "Every incoming order, from every channel, lands in one queue. The status pipeline is clear - New, Processing, Shipped, Delivered. Filter by channel like ONDC, Amazon, Flipkart, or direct, search by order ID or customer, and accept, ship, or cancel right from the row.",
    "Click any order to open the full detail page. Customer and address up top, line items with taxes and totals, and a complete timeline of status changes. From here the seller marks the order ready for dispatch, invoices it, or hands it to the platform's built-in logistics solution for delivery.",
    "Customers shows every retailer who buys from this distributor. Even when a single retailer is buying multiple brands across multiple companies, the seller sees the full picture in one place. Approval is scoped per company and brand, so the same retailer can be approved for one and pending for another.",
    "The customer detail page rolls up the profile, per-company approval status, and the complete order history. And the entire customer list, or any filtered slice, exports to CSV - ready to be pulled into Tally or any other accounting software the distributor already uses.",
    "Settings is where the seller configures the store. Seven groups - Store, Order, Shipping, Serviceability, Payment, Customer, and Communication.",
    "Shipping and Serviceability are where the planning happens. Serviceability is configured beat-wise, mapped to the distributor's existing delivery routes. So when an order comes in, the platform already knows when that PIN code is scheduled, and the customer gets the right delivery promise on the spot. There's also a simple shop on or off switch, so the seller can pause new orders any time.",
    "Communication is where the WhatsApp plugin lives. Every new order fires a WhatsApp notification straight to the seller, so no order ever slips through. And under Connectors, that one ONDC connector lights up the seller's catalog across every buyer app on the network.",
    "Reports rolls everything up into six dashboards - Sales and Orders, Inventory, Product Performance, Customer Insights, Schemes and Offers, and Operations and Delivery. These give the seller the numbers he needs for stock analysis, sales planning, and the day-to-day decisions that drive business growth.",
    "And that's the Qwipo Seller Store from the seller's point of view. One platform for catalog, bulk pricing, orders, customers, ONDC reach, WhatsApp alerts, logistics, and reporting - the fastest way to bring an offline distribution business online. Thanks for watching."
)

if ($keep.Count -ne $narration.Count) {
    throw "keep ($($keep.Count)) and narration ($($narration.Count)) counts must match"
}

# ---------- 1. Generate MP3 per slide via Edge neural TTS ----------
Write-Host "Generating narration with $Voice (rate $Rate)..."
$durations = @()
for ($i = 0; $i -lt $narration.Count; $i++) {
    $mp3 = Join-Path $audioDir ("slide_{0:00}.mp3" -f ($i + 1))
    if (Test-Path $mp3) { Remove-Item $mp3 -Force }
    & $python -m edge_tts --voice $Voice --rate $Rate --text $narration[$i] --write-media $mp3 2>&1 | Out-Null
    if (-not (Test-Path $mp3)) { throw "edge-tts failed to produce $mp3 for slide $($i+1)" }
    $durStr = & $ffprobe -v error -show_entries format=duration -of csv=p=0 $mp3
    $dur = [math]::Round([double]$durStr, 2)
    $durations += $dur
    Write-Host ("  slide {0:00}: {1}s" -f ($i + 1), $dur)
}
$totalSec = ($durations | Measure-Object -Sum).Sum
Write-Host ("Total narration: {0:N1}s ({1:N2} min)" -f $totalSec, ($totalSec / 60.0))

# ---------- 2. Copy source deck ----------
Write-Host "Copying deck..."
Copy-Item -Path $src -Destination $work -Force

# ---------- 3. PowerPoint COM: trim slides, set per-slide auto-advance ----------
Write-Host "Opening PowerPoint..."
$ppt = New-Object -ComObject PowerPoint.Application
$pres = $ppt.Presentations.Open($work)

$total = $pres.Slides.Count
Write-Host "Trimming slides from $total to $($keep.Count)..."
for ($idx = $total; $idx -ge 1; $idx--) {
    if (-not ($keep -contains $idx)) {
        $pres.Slides.Item($idx).Delete()
    }
}
if ($pres.Slides.Count -ne $keep.Count) {
    throw "Expected $($keep.Count) slides after trim, got $($pres.Slides.Count)"
}

$msoTrue  = -1
$msoFalse = 0

Write-Host "Setting per-slide auto-advance timings..."
for ($i = 1; $i -le $pres.Slides.Count; $i++) {
    $slide = $pres.Slides.Item($i)
    $advance = [math]::Round($durations[$i - 1] + 0.3, 2)
    $slide.SlideShowTransition.AdvanceOnTime  = $msoTrue
    $slide.SlideShowTransition.AdvanceOnClick = $msoFalse
    $slide.SlideShowTransition.AdvanceTime    = $advance
}

Write-Host "Saving deck..."
$pres.Save()

Write-Host "Exporting silent MP4 from PowerPoint (audio will be muxed in by ffmpeg)..."
if (Test-Path $mp4Silent) { Remove-Item $mp4Silent -Force }
if (Test-Path $mp4)       { Remove-Item $mp4       -Force }
$pres.CreateVideo($mp4Silent, $true, 5, 720, 30, 85)

$deadline = (Get-Date).AddMinutes(15)
$lastSize = -1
while ($true) {
    Start-Sleep -Seconds 3
    $status = $pres.CreateVideoStatus
    $sz = if (Test-Path $mp4Silent) { (Get-Item $mp4Silent).Length } else { 0 }
    if ($sz -ne $lastSize) {
        Write-Host ("  status={0}, size={1:N0} bytes" -f $status, $sz)
        $lastSize = $sz
    }
    if ($status -eq 3) { break }
    if ($status -eq 4) { throw "PowerPoint reported video export failed." }
    if ((Get-Date) -gt $deadline) { throw "MP4 export timed out after 15 minutes." }
}

$pres.Close()
$ppt.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt)  | Out-Null
[GC]::Collect(); [GC]::WaitForPendingFinalizers()

# ---------- 4. Mux narration onto silent MP4 with ffmpeg ----------
Start-Sleep -Seconds 2
Write-Host "Muxing narration onto silent MP4 with ffmpeg..."

$filterParts = @()
for ($i = 1; $i -le $keep.Count; $i++) {
    $filterParts += "[${i}:a]apad=pad_dur=0.3,asetpts=PTS-STARTPTS[a$i]"
}
$concatInputs = ((1..$keep.Count) | ForEach-Object { "[a$_]" }) -join ""
$filter = ($filterParts -join ";") + ";" + $concatInputs + "concat=n=$($keep.Count):v=0:a=1[aout]"

$ffArgs = @("-y", "-hide_banner", "-loglevel", "error", "-i", $mp4Silent)
for ($i = 1; $i -le $keep.Count; $i++) {
    $ffArgs += @("-i", (Join-Path $audioDir ("slide_{0:00}.mp3" -f $i)))
}
$ffArgs += @("-filter_complex", $filter, "-map", "0:v", "-map", "[aout]",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
             "-shortest", $mp4)

& $ffmpeg @ffArgs
if ($LASTEXITCODE -ne 0) { throw "ffmpeg mux failed with exit code $LASTEXITCODE" }

# ---------- 5. Verify MP4 has both video and audio tracks ----------
$bytes = [System.IO.File]::ReadAllBytes($mp4)
$hasVideo = $false; $hasAudio = $false
for ($i = 0; $i -lt $bytes.Length - 20; $i++) {
    if ($bytes[$i] -eq 0x68 -and $bytes[$i+1] -eq 0x64 -and $bytes[$i+2] -eq 0x6C -and $bytes[$i+3] -eq 0x72) {
        $type = -join @([char]$bytes[$i+12], [char]$bytes[$i+13], [char]$bytes[$i+14], [char]$bytes[$i+15])
        if ($type -eq 'vide') { $hasVideo = $true }
        if ($type -eq 'soun') { $hasAudio = $true }
    }
}
Write-Host ("MP4 tracks: video={0} audio={1}" -f $hasVideo, $hasAudio)
if (-not $hasAudio) {
    Write-Warning "MP4 has no audio track. Keeping intermediate artifacts for debugging."
    $KeepArtifacts = $true
}

# ---------- 6. Clean up ----------
if (-not $KeepArtifacts) {
    Write-Host "Cleaning up intermediate artifacts..."
    if (Test-Path $work)       { Remove-Item $work       -Force }
    if (Test-Path $mp4Silent)  { Remove-Item $mp4Silent  -Force }
    if (Test-Path $audioDir)   { Remove-Item $audioDir   -Recurse -Force }
}

$mp4Size = (Get-Item $mp4).Length
Write-Host ("DONE: {0}  ({1:N1} MB)" -f $mp4, ($mp4Size / 1MB))
