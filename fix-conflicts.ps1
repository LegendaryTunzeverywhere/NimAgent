# Fix all merge conflicts by removing markers
$files = Get-ChildItem -Recurse -File -Exclude node_modules,*.git* | Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*.git*" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    
    if ($content -match '<<<<<<<|=======|>>>>>>>') {
        Write-Host "Fixing: $($file.Name)"
        
        # Remove conflict markers and keep HEAD version
        $fixed = $content -replace '(?s)<<<<<<< HEAD\r?\n(.*?)\r?\n=======\r?\n.*?\r?\n>>>>>>> [a-f0-9]+\r?\n?', '$1'
        
        Set-Content -Path $file.FullName -Value $fixed -NoNewline
    }
}

Write-Host "Done fixing conflicts!"
