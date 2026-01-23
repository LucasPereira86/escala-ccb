$csvPath = "C:\Users\Cliente\.gemini\antigravity\scratch\escala-ccb\De Para EWM  PRD rev4.csv"
$jsPath = "C:\Users\Cliente\.gemini\antigravity\scratch\escala-ccb\ewm-data.js"

Write-Host "Lendo CSV..."
$content = Get-Content $csvPath -Encoding Default
$totalLines = $content.Count

Write-Host "Total de linhas: $totalLines"

$jsData = "const EWM_DATA = [" + [Environment]::NewLine

# Ignora o cabeçalho (linha 0) e começa da linha 1
for ($i = 1; $i -lt $totalLines; $i++) {
    $line = $content[$i]
    if (-not [string]::IsNullOrWhiteSpace($line)) {
        # Split por ponto e vírgula
        $parts = $line -split ";"
        
        if ($parts.Count -ge 2) {
            # Limpa aspas simples que podem quebrar o JS
            $material = $parts[0].Trim()
            $tipo = $parts[1].Trim()
            $antigo = $parts[2].Trim()
            $unidade = $parts[3].Trim()
            
            # O texto pode conter ponto e vírgula extra ou ser o resto da linha
            # Junta o resto das partes para o texto
            $texto = $parts[4..($parts.Count-1)] -join " "
            $texto = $texto.Trim().Replace("'", "\'") # Escapa aspas simples
            $texto = $texto.Replace("`"", "") # Remove aspas duplas se houver

            $obj = "    { material: '$material', tipo: '$tipo', antigo: '$antigo', unidade: '$unidade', texto: '$texto' }"
            
            # Adiciona vírgula se não for o último
            if ($i -lt ($totalLines - 1)) {
                $obj += ","
            }
            
            $jsData += $obj + [Environment]::NewLine
        }
    }
    
    if ($i % 1000 -eq 0) {
        Write-Host "Processando linha $i..."
    }
}

$jsData += "];"

Write-Host "Salvando arquivo JS..."
Set-Content -Path $jsPath -Value $jsData -Encoding UTF8

Write-Host "Conversão concluída com sucesso!"
