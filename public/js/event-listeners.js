import { handleFormSubmit } from './form-handler.js';
import { exportToExcel } from './export-handler.js';

document.getElementById('exportExcelButton').addEventListener('click', exportToExcel);

document.getElementById('motivo').addEventListener('change', function () {
    if (this.value === 'VENCIDO') {
        document.getElementById('dataVencimentoGroup').style.display = 'block';
    } else {
        document.getElementById('dataVencimentoGroup').style.display = 'none';
    }
});

document.getElementById('productForm').addEventListener('submit', handleFormSubmit);

document.getElementById('resetButton').addEventListener('click', function () {
    const password = prompt('Digite a senha para confirmar o reset:');
    if (password === '1234') {
        const confirmation = confirm('Tem certeza que deseja resetar a lista de produtos? Esta ação não pode ser desfeita.');
        if (confirmation) {
            fetch('/resetProducts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Lista de produtos resetada com sucesso.');
                    location.reload();
                }
            })
            .catch(error => {
                console.error('Erro:', error);
            });
        }
    } else {
        alert('Senha incorreta.');
    }
});
