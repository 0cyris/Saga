export function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
    downloadBlob(blob, filename);
}

export function downloadBytes(data, filename, mimeType = 'application/octet-stream') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
