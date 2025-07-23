//Implementa a funcionalidade de exportação para Excel.

export function exportToExcel() {
    fetch('/exportToExcel')
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(new Blob([blob]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'produtos.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(err => console.error('Erro ao exportar para Excel:', err));
}
