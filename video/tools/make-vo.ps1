# Synthesises a narration track, one WAV per script line, fitted to each line's
# slot in src/script.ts.
#
# This is a stand-in voice. It exists so the piece is audible and its pacing can
# be judged; replace any line by dropping your own recording over the same
# filename and re-rendering. Nothing else has to change.
#
# For each line it tries a range of SAPI speaking rates and keeps the SLOWEST
# one that still fits the slot - a rushed line is worse than a slightly early
# one, and every slot has a deliberate pause after it to absorb the difference.

param(
  [string]$LinesJson = "$PSScriptRoot\..\out\lines.json",
  [string]$OutDir    = "$PSScriptRoot\..\public\vo",
  [string]$VoiceName = 'Microsoft David Desktop',
  [int]$BaseRate    = 1
)

Add-Type -AssemblyName System.Speech
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

# Reads a PCM WAV's real duration from its fmt/data chunks rather than assuming
# the synthesiser's default sample rate.
function Get-WavSeconds([string]$Path) {
  $fs = [System.IO.File]::OpenRead($Path)
  try {
    $br = New-Object System.IO.BinaryReader($fs)
    $null = $br.ReadBytes(12)                      # RIFF....WAVE
    $byteRate = 0; $dataLen = 0
    while ($fs.Position -lt $fs.Length - 8) {
      $id   = [System.Text.Encoding]::ASCII.GetString($br.ReadBytes(4))
      $size = $br.ReadUInt32()
      if ($id -eq 'fmt ') {
        $null = $br.ReadUInt16(); $null = $br.ReadUInt16()   # format, channels
        $null = $br.ReadUInt32()                             # sample rate
        $byteRate = $br.ReadUInt32()
        $null = $br.ReadBytes([int]$size - 12)
      } elseif ($id -eq 'data') {
        $dataLen = $size
        break
      } else {
        $null = $br.ReadBytes([int]$size)
      }
    }
    if ($byteRate -le 0) { return 0 }
    return [math]::Round($dataLen / $byteRate, 3)
  } finally { $fs.Dispose() }
}

$lines = Get-Content -Raw -Path $LinesJson | ConvertFrom-Json

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$available = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($available -notcontains $VoiceName) {
  $VoiceName = ($available | Select-Object -First 1)
  Write-Host "requested voice unavailable; using '$VoiceName'"
}
$synth.SelectVoice($VoiceName)
$synth.Volume = 100

# Start at one base rate and only speed up the lines that genuinely overrun.
# Picking the slowest fitting rate per line independently sounds jumpy - it put
# adjacent lines at -3 and +5 - so uniformity wins over squeezing each slot.
$rates = @($BaseRate) + (($BaseRate + 1)..8)
$tmp = Join-Path $env:TEMP 'rote-vo-probe.wav'
$report = @()

foreach ($l in $lines) {
  $target = [double]$l.target
  $best = $null

  foreach ($r in $rates) {
    $synth.Rate = $r
    $synth.SetOutputToWaveFile($tmp)
    $synth.Speak([string]$l.text)
    $synth.SetOutputToNull()
    $secs = Get-WavSeconds $tmp

    if ($secs -le $target) {
      $best = @{rate = $r; secs = $secs}
      break                      # slowest fitting rate wins
    }
    $best = @{rate = $r; secs = $secs}   # nothing fits yet; keep the fastest tried
  }

  $final = Join-Path $OutDir "$($l.id).wav"
  $synth.Rate = $best.rate
  $synth.SetOutputToWaveFile($final)
  $synth.Speak([string]$l.text)
  $synth.SetOutputToNull()

  $fit = if ($best.secs -le $target) { 'ok  ' } else { 'OVER' }
  $report += "{0} {1}  rate {2,3}  {3,5:N2}s / {4,5:N2}s" -f $fit, $l.id, $best.rate, $best.secs, $target
}

$synth.Dispose()
if (Test-Path $tmp) { Remove-Item $tmp -Force }

$report | ForEach-Object { Write-Host $_ }
Write-Host ("`n{0} lines written to {1}" -f $lines.Count, $OutDir)
Write-Host ("over-slot: {0}" -f (($report | Where-Object { $_ -like 'OVER*' }).Count))
