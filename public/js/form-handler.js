import { addProductToTable, updateProductInTable } from './table-handler.js';

let editingRow = null;
let editingProductId = null;

export const productCodes = [];
export const productNames = [];
export const userNames = [];

export function setEditingRow(row, productId = null) {
    editingRow = row;
    editingProductId = productId;
}

export function clearEditingState() {
    editingRow = null;
    editingProductId = null;
}

// Função para validar campos do formulário
function validateForm(formData) {
    const errors = [];
    
    if (!formData.codigo.trim()) {
        errors.push('Código do produto é obrigatório');
    }
    
    if (!formData.produto.trim()) {
        errors.push('Nome do produto é obrigatório');
    }
    
    if (!formData.valor.trim() || formData.valor === 'R$') {
        errors.push('Valor do produto é obrigatório');
    }
    
    if (!formData.quantidade || formData.quantidade <= 0) {
        errors.push('Quantidade deve ser maior que zero');
    }
    
    if (!formData.motivo) {
        errors.push('Motivo é obrigatório');
    }
    
    if (formData.motivo === 'VENCIDO' && !formData.dataVencimento) {
        errors.push('Data de vencimento é obrigatória para produtos vencidos');
    }
    
    if (!formData.usuario.trim()) {
        errors.push('Usuário é obrigatório');
    }
    
    return errors;
}

// Função para formatar valor monetário
function formatCurrency(value) {
    if (!value || value === 'R$') return 'R$ 0,00';
    
    // Remove tudo exceto números, vírgulas e pontos
    const numericValue = value.replace(/[^\d,.-]/g, '');
    
    // Se não há valor numérico, retorna formato padrão
    if (!numericValue) return 'R$ 0,00';
    
    // Converte para formato brasileiro se necessário
    if (numericValue.includes('.') && !numericValue.includes(',')) {
        // Formato americano (123.45) -> brasileiro (123,45)
        const parts = numericValue.split('.');
        if (parts.length === 2 && parts[1].length <= 2) {
            return `R$ ${parts[0]},${parts[1].padEnd(2, '0')}`;
        }
    }
    
    return value.startsWith('R$') ? value : `R$ ${numericValue}`;
}

// Função para limpar o formulário
function clearForm() {
    document.getElementById('productForm').reset();
    document.getElementById('valor').value = 'R$';
    document.getElementById('dataVencimentoGroup').style.display = 'none';
}

export function handleFormSubmit(event) {
    event.preventDefault();

    try {
        // Coleta dados do formulário
        const formData = {
            codigo: document.getElementById('codigo').value.trim(),
            produto: document.getElementById('produto').value.trim(),
            quantidade: parseInt(document.getElementById('quantidade').value),
            motivo: document.getElementById('motivo').value,
            dataVencimento: document.getElementById('dataVencimento').value,
            valor: formatCurrency(document.getElementById('valor').value),
            usuario: document.getElementById('usuario').value.trim()
        };

        // Validar dados
        const errors = validateForm(formData);
        if (errors.length > 0) {
            alert('Erro de validação:\n' + errors.join('\n'));
            return;
        }

        // Formatar data de vencimento se necessário
        if (formData.motivo === 'VENCIDO' && formData.dataVencimento) {
            const date = new Date(formData.dataVencimento);
            formData.dataVencimento = date.toLocaleDateString('pt-BR', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            });
        } else {
            formData.dataVencimento = '';
        }

        // Adicionar timestamp
        const now = new Date();
        formData.dataHoraInsercao = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');

        if (editingRow !== null) {
            // Modo edição
            updateProduct(formData);
        } else {
            // Modo criação
            addProduct(formData);
        }

    } catch (error) {
        console.error('Erro ao processar formulário:', error);
        alert('Erro ao processar dados do formulário');
    }
}

function addProduct(productData) {
    fetch('/addProduct', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Produto adicionado com sucesso!');
            addProductToTable(data.product || productData);
            updateAutocompleteArrays(productData);
            clearForm();
        } else {
            alert('Erro ao adicionar produto: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
        alert('Erro de conexão ao adicionar produto');
    });
}

function updateProduct(productData) {
    if (!editingProductId) {
        // Fallback para o método antigo se não tiver ID
        updateProductInTable(editingRow, productData);
        logEdit(productData);
        clearEditingState();
        clearForm();
        return;
    }

    fetch(`/updateProduct/${editingProductId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Produto atualizado com sucesso!');
            updateProductInTable(editingRow, data.product || productData);
            updateAutocompleteArrays(productData);
        } else {
            alert('Erro ao atualizar produto: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
        // Fallback para o método local
        updateProductInTable(editingRow, productData);
        logEdit(productData);
    })
    .finally(() => {
        clearEditingState();
        clearForm();
    });
}

function logEdit(productData) {
    fetch('/logEdit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'edit',
            product: productData
        })
    }).catch(error => {
        console.error('Erro ao registrar log:', error);
    });
}

function updateAutocompleteArrays(productData) {
    if (!productCodes.includes(productData.codigo)) {
        productCodes.push(productData.codigo);
    }
    if (!productNames.includes(productData.produto)) {
        productNames.push(productData.produto);
    }
    if (!userNames.includes(productData.usuario)) {
        userNames.push(productData.usuario);
    }
}

// Configurar formatação automática do campo valor
document.addEventListener('DOMContentLoaded', function() {
    const valorInput = document.getElementById('valor');
    
    if (valorInput) {
        valorInput.addEventListener('input', function(e) {
            const cursorPosition = e.target.selectionStart;
            const value = e.target.value;
            const formattedValue = formatCurrency(value);
            
            if (formattedValue !== value) {
                e.target.value = formattedValue;
                // Restaurar posição do cursor aproximadamente
                const newCursorPosition = Math.min(cursorPosition, formattedValue.length);
                e.target.setSelectionRange(newCursorPosition, newCursorPosition);
            }
        });

        valorInput.addEventListener('focus', function(e) {
            if (e.target.value === 'R$') {
                e.target.setSelectionRange(e.target.value.length, e.target.value.length);
            }
        });
    }
});

// Tornar editProduct acessível no escopo global
import { editProduct } from './table-handler.js';
window.editProduct = editProduct;