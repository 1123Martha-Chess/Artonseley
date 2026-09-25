# programarTarea.ps1 — Registra (o vuelve a registrar) la revisión diaria en el Programador de tareas de Windows.
#
# Uso (PowerShell, sin permisos de administrador):
#   powershell -ExecutionPolicy Bypass -File programarTarea.ps1            # diario a las 20:00
#   powershell -ExecutionPolicy Bypass -File programarTarea.ps1 -Hora 09:30
#
# Para quitarla:  Unregister-ScheduledTask -TaskName "ChecarLeyes Artonseley" -Confirm:$false

param([string]$Hora = "20:00")

$carpeta = $PSScriptRoot
$node = (Get-Command node).Source

$accion = New-ScheduledTaskAction -Execute $node -Argument "`"$carpeta\checarLeyes.js`"" -WorkingDirectory $carpeta
$disparador = New-ScheduledTaskTrigger -Daily -At $Hora
# StartWhenAvailable: si la computadora estaba apagada a esa hora, corre en cuanto se prenda.
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName "ChecarLeyes Artonseley" -Action $accion -Trigger $disparador -Settings $ajustes `
  -Description "Revisa diario la Cámara de Diputados y el DOF; actualiza los CSV y la bitácora de ChecarLeyes." -Force | Out-Null

Write-Output "Tarea 'ChecarLeyes Artonseley' programada diario a las $Hora (carpeta: $carpeta)."
