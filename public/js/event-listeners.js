import { handleFormSubmit } from './form-handler.js';
import { exportToExcel } from './export-handler.js';

// Event listener para exportar Excel
document.getElementById('exportExcelButton').addEventListener('click', exportToExcel);

// Event listener para mostrar/ocultar campo de data de vencimento
document.getElementById('motivo').addEventListener('change', function () {
    const dataVencimentoGroup = document.getElementById('dataVencimentoGroup');
    const dataVencimentoInput = document.getElementById('dataVencimento');
    
    if (this.value === 'VENCIDO') {
        dataVencimentoGroup.style.display = 'block';
        dataVencimentoInput.required = true;
    } else {
        dataVencimentoGroup.style.display = 'none';
        dataVencimentoInput.required = false;
        dataVencimentoInput.value = ''; // Limpar o valor quando não é necessário
    }
});

// Event listener para submissão do formulário
document.getElementById('productForm').addEventListener('submit', handleFormSubmit);

// Event listener para reset da lista
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
                } else {
                    alert('Erro ao resetar: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Erro:', error);
                alert('Erro de conexão ao resetar lista.');
            });
        }
    } else if (password !== null) { // Se não cancelou o prompt
        alert('Senha incorreta.');
    }
});