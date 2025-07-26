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
    
    if (!formData.codigo || !formData.codigo.trim()) {
        errors.push('Código do produto é obrigatório');
    }
    
    if (!formData.produto || !formData.produto.trim()) {
        errors.push('Nome do produto é obrigatório');
    }
    
    if (!formData.valor || formData.valor.trim() === '' || formData.valor.trim() === 'R$') {
        errors.push('Valor do produto é obrigatório');
    }
    
    if (!formData.quantidade || isNaN(formData.quantidade) || formData.quantidade <= 0) {
        errors.push('Quantidade deve ser maior que zero');
    }
    
    if (!formData.motivo || formData.motivo.trim() === '') {
        errors.push('Motivo é obrigatório');
    }
    
    if (formData.motivo === 'VENCIDO' && (!formData.dataVencimento || formData.dataVencimento.trim() === '')) {
        errors.push('Data de vencimento é obrigatória para produtos vencidos');
    }
    
    if (!formData.usuario || !formData.usuario.trim()) {
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

// Função CORRIGIDA para converter data do formato ISO para brasileiro SEM perder um dia
function formatDateToBrazilian(isoDate) {
    if (!isoDate || !isoDate.includes('-')) return '';
    
    try {
        // Criar data local sem conversão de fuso horário
        const parts = isoDate.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const day = parseInt(parts[2]);
            
            // Validar se é uma data válida
            if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                // Formatar com zero à esquerda se necessário
                const dayFormatted = day.toString().padStart(2, '0');
                const monthFormatted = month.toString().padStart(2, '0');
                return `${dayFormatted}/${monthFormatted}/${year}`;
            }
        }
    } catch (error) {
        console.error('Erro ao formatar data:', error);
    }
    
    return isoDate;
}

// Função CORRIGIDA para converter data brasileira para formato ISO SEM perder um dia
function formatDateToISO(brazilianDate) {
    if (!brazilianDate || !brazilianDate.includes('/')) return '';
    
    try {
        const parts = brazilianDate.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            
            // Validar se é uma data válida
            if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                // Formatar com zero à esquerda se necessário
                const dayFormatted = day.toString().padStart(2, '0');
                const monthFormatted = month.toString().padStart(2, '0');
                return `${year}-${monthFormatted}-${dayFormatted}`;
            }
        }
    } catch (error) {
        console.error('Erro ao converter data para ISO:', error);
    }
    
    return brazilianDate;
}

// Função para limpar o formulário
function clearForm() {
    document.getElementById('productForm').reset();
    document.getElementById('valor').value = 'R$';
    document.getElementById('dataVencimentoGroup').style.display = 'none';
    document.getElementById('dataVencimento').required = false;
}

export function handleFormSubmit(event) {
    event.preventDefault();

    try {
        // Coleta dados do formulário
        const rawDataVencimento = document.getElementById('dataVencimento').value;
        const motivo = document.getElementById('motivo').value;
        
        const formData = {
            codigo: document.getElementById('codigo').value.trim(),
            produto: document.getElementById('produto').value.trim(),
            quantidade: parseInt(document.getElementById('quantidade').value),
            motivo: motivo,
            dataVencimento: rawDataVencimento,
            valor: formatCurrency(document.getElementById('valor').value),
            usuario: document.getElementById('usuario').value.trim()
        };

        // Validar dados
        const errors = validateForm(formData);
        if (errors.length > 0) {
            alert('Erro de validação:\n' + errors.join('\n'));
            return;
        }

        // Processar data de vencimento corretamente
        if (formData.motivo === 'VENCIDO' && formData.dataVencimento) {
            // Converter do formato ISO (YYYY-MM-DD) para brasileiro (DD/MM/YYYY) SEM perder dia
            formData.dataVencimento = formatDateToBrazilian(formData.dataVencimento);
            console.log('Data convertida:', rawDataVencimento, '->', formData.dataVencimento);
        } else {
            formData.dataVencimento = '';
        }

        // Adicionar timestamp
        const now = new Date();
        const currentDateTime = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
        
        if (editingRow === null) {
            // Novo produto
            formData.dataHoraInsercao = currentDateTime;
            formData.dataUltimaModificacao = currentDateTime;
        } else {
            // Produto sendo editado - manter data de inserção original
            const originalDataInsercao = editingRow.children[8].textContent;
            formData.dataHoraInsercao = originalDataInsercao;
            formData.dataUltimaModificacao = currentDateTime;
        }

        if (editingRow !== null) {
            // Modo edição
            updateProduct(formData);
        } else {
            // Modo criação
            addProduct(formData);
        }

    } catch (error) {
        console.error('Erro ao processar formulário:', error);
        alert('Erro ao processar dados do formulário: ' + error.message);
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
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
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
        alert('Erro de conexão ao adicionar produto: ' + error.message);
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

// Exportar as funções de conversão de data para uso em outros módulos
export { formatDateToBrazilian, formatDateToISO };