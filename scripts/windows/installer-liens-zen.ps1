# Enregistre le protocole « zen-open: » pour l'utilisateur courant (sans droits administrateur).
# Trajectoire, installée depuis Chrome, réécrit ses liens externes en zen-open:<URL encodée> quand
# « Liens externes : Zen » est choisi dans Paramètres ; ce protocole les ouvre dans Zen.
#
# Depuis WSL :
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w scripts/windows/installer-liens-zen.ps1)"
# Pour tout retirer : ajouter -Desinstaller.

param([switch]$Desinstaller)
$ErrorActionPreference = 'Stop'

$cle = 'HKCU:\Software\Classes\zen-open'
$dossier = Join-Path $env:LOCALAPPDATA 'Trajectoire'
$lanceur = Join-Path $dossier 'zen-open.js'

if ($Desinstaller) {
  if (Test-Path $cle) { Remove-Item $cle -Recurse -Force }
  if (Test-Path $lanceur) { Remove-Item $lanceur -Force }
  Write-Host 'Protocole zen-open retiré.'
  exit 0
}

# Emplacement de Zen : installations courantes, puis l'enregistrement « App Paths ».
$candidats = @(
  (Join-Path $env:ProgramFiles 'Zen Browser\zen.exe'),
  (Join-Path $env:LOCALAPPDATA 'Zen Browser\zen.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\Zen Browser\zen.exe')
)
foreach ($ap in 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\zen.exe', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\zen.exe') {
  if (Test-Path $ap) { $candidats += (Get-ItemProperty $ap).'(default)' }
}
$zen = $candidats | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $zen) { throw "zen.exe introuvable. Emplacements essayés : $($candidats -join ', ')" }

# Lanceur JScript (wscript : aucune fenêtre ne s'affiche). Il n'accepte que des adresses http(s) sans
# caractère spécial, et passe par ShellExecute (pas d'expansion des %VARIABLES%, pas de cmd).
New-Item -ItemType Directory -Force -Path $dossier | Out-Null
$zenJs = $zen.Replace('\', '\\')
$code = @'
// Genere par installer-liens-zen.ps1 (Trajectoire) : ouvre zen-open:<URL encodee> dans Zen.
var ZEN = "__ZEN__";
var arg = WScript.Arguments.length ? WScript.Arguments(0) : "";
var m = /^zen-open:(.+)$/i.exec(arg);
if (m) {
  var url = null;
  try { url = decodeURIComponent(m[1].replace(/\/+$/, "")); } catch (e) {}
  if (url && /^https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+$/.test(url)) {
    new ActiveXObject("Shell.Application").ShellExecute(ZEN, '"' + url + '"', "", "open", 1);
  }
}
'@
$code = $code.Replace('__ZEN__', $zenJs)
[System.IO.File]::WriteAllText($lanceur, $code, [System.Text.Encoding]::ASCII)

$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
New-Item -Path $cle -Force | Out-Null
Set-ItemProperty -Path $cle -Name '(default)' -Value 'URL:Ouvrir dans Zen (Trajectoire)'
Set-ItemProperty -Path $cle -Name 'URL Protocol' -Value ''
New-Item -Path "$cle\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$cle\shell\open\command" -Name '(default)' -Value "`"$wscript`" //B //E:jscript `"$lanceur`" `"%1`""

Write-Host "Protocole zen-open enregistré : $zen"
Write-Host 'Dans Trajectoire : Paramètres > Liens externes > Zen, puis « Tester » (cocher « Toujours autoriser »).'
