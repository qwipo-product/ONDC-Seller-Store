param(
    [string]$SourcePptx = "Documents\Seller-Store-Walkthrough.pptx",
    [string]$WorkPptx   = "Documents\Seller-Store-Walkthrough-Video.pptx",
    [string]$OutMp4     = "Demo Videos\Seller-Store-Walkthrough-Video.mp4",
    [string]$Voice      = "en-IN-NeerjaNeural",   # neural en-IN female. Use "en-IN-PrabhatNeural" for male.
    [string]$Rate       = "+15%",                  # +5%/+10%/+15% to speed up, -5%/-10% to slow down
    [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"
$root = "C:\Users\Lenovo\OneDrive - Xavica Primary\Desktop\Seller Store"
Set-Location $root

$src       = Join-Path $root $SourcePptx
$work      = Join-Path $root $WorkPptx
$mp4       = Join-Path $root $OutMp4
$mp4Silent = [System.IO.Path]::ChangeExtension($mp4, $null) + ".silent.mp4"
$audioDir  = Join-Path $root "Documents\_walkthrough_audio"

$python   = "C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe"
$ffmpeg   = "C:\Users\Lenovo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
$ffprobe  = "C:\Users\Lenovo\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffprobe.exe"
foreach ($p in @($python, $ffmpeg, $ffprobe)) {
    if (-not (Test-Path $p)) { throw "Required tool not found: $p" }
}

if (-not (Test-Path $audioDir)) { New-Item -ItemType Directory -Path $audioDir | Out-Null }

# Slides to KEEP from the original 31-slide deck (in original order).
$keep = @(1, 3, 5, 6, 8, 11, 14, 15, 16, 20, 22, 24, 26, 29, 31)

# Conversational narration - sounds like a human walking through the product.
# No "Phase 1" framing; just what's there.
$narration = @(
    "Welcome to a quick tour of the Qwipo Seller Store. I'll cover both sides - the Super Admin who runs the network, and the seller who runs their distribution business.",
    "Everyone signs in through the same screen. Once authenticated, Super Admins land on the admin console, and sellers land on their own dashboard.",
    "The Super Admin has four modules. Sellers for distributor management, Companies and Brands for the master catalog, Connectors for DMS and ONDC, and a Requests queue for pending approvals.",
    "Onboarding a distributor starts here. Open Sellers, click Add Seller. Search by name, business, city or phone, and any row opens the full seller detail page.",
    "Then pick the companies the distributor carries - ITC, Hindustan Unilever, Nestle - and assign their brands. Pick specific brands, or just All to auto-include new ones later.",
    "Connectors plug the seller into the wider system. DMS syncs masters, stock and pricing. ONDC handles digital commerce. Both wire up right from the seller's detail page.",
    "On the seller side, the distributor gets My SKU for catalog, Orders, Customers, Offers and Schemes, plus Settings and Reports.",
    "My SKU lists every product the seller carries. Filter by brand, category or status, search by name, code or HSN, and edit price or inventory right inside the row.",
    "Three ways to grow the catalog. Add a SKU manually, bulk import using a CSV template, or pull pre-validated SKUs straight from Qwipo's central master catalog.",
    "Every incoming order lands in one queue with a New, Processing, Shipped, Delivered pipeline. Filter by channel like ONDC or Amazon, and accept, ship or cancel right from the row.",
    "Customers shows every retailer buying from this distributor. Bulk approve, reject or reopen accounts. Approvals are scoped per company and brand, so a retailer can be approved for one and pending for another.",
    "Offers and Schemes runs on Quantity Pricing. Slab-based discounts - buy ten, get five percent off; buy fifty, get fifteen. Scope it to a brand, category, or specific SKUs, for any date range.",
    "Settings has seven groups. Store branding, Order rules, Shipping, Serviceability by PIN code, Payment methods, Customer onboarding, and Communication templates for SMS, email and WhatsApp.",
    "Reports rolls up into six dashboards. Sales and Orders, Inventory, Product Performance, Customer Insights, Schemes and Offers, and Operations and Delivery.",
    "That's the platform end-to-end. Super Admin onboards distributors and wires their brands and connectors. The seller runs catalog, orders, customers, offers, settings and reports - all from one place. Thanks for watching."
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
    # edge-tts writes the MP3 directly; using --text not --file to avoid file roundtrip
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
