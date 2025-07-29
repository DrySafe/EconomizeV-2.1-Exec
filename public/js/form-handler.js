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

// Função APRIMORADA para formatar valor monetário brasileiro
function formatCurrency(value) {
    if (!value || value === 'R$') return 'R$ 0,00';
    
    // Remove tudo exceto números, vírgulas e pontos
    let numericValue = value.replace(/[^\d,.-]/g, '');
    
    // Se não há valor numérico, retorna formato padrão
    if (!numericValue) return 'R$ 0,00';
    
    // Remove espaços e caracteres extras
    numericValue = numericValue.trim();
    
    // Casos especiais para formatação automática
    if (numericValue.match(/^\d+$/)) {
        // Apenas números inteiros (ex: "532" -> "5,32", "49" -> "0,49", "6200" -> "62,00")
        const num = parseInt(numericValue);
        
        if (num === 0) {
            return 'R$ 0,00';
        }
        
        if (num < 10) {
            // 1-9: adiciona 0, antes (ex: "5" -> "0,05")
            return `R$ 0,0${num}`;
        } else if (num < 100) {
            // 10-99: adiciona 0, antes (ex: "49" -> "0,49")
            return `R$ 0,${num.toString().padStart(2, '0')}`;
        } else {
            // 100+: divide por 100 para obter centavos (ex: "532" -> "5,32")
            const reais = Math.floor(num / 100);
            const centavos = num % 100;
            return `R$ ${reais},${centavos.toString().padStart(2, '0')}`;
        }
    }
    
    // Se já tem vírgula, processar formato brasileiro
    if (numericValue.includes(',')) {
        const parts = numericValue.split(',');
        if (parts.length === 2) {
            const reais = parts[0] || '0';
            let centavos = parts[1];
            
            // Limitar centavos a 2 dígitos
            if (centavos.length > 2) {
                centavos = centavos.substring(0, 2);
            } else if (centavos.length === 1) {
                centavos = centavos + '0';
            } else if (centavos.length === 0) {
                centavos = '00';
            }
            
            return `R$ ${reais},${centavos}`;
        }
    }
    
    // Se tem ponto (formato americano), converter para brasileiro
    if (numericValue.includes('.') && !numericValue.includes(',')) {
        const parts = numericValue.split('.');
        if (parts.length === 2 && parts[1].length <= 2) {
            const reais = parts[0] || '0';
            const centavos = parts[1].padEnd(2, '0');
            return `R$ ${reais},${centavos}`;
        }
    }
    
    // Se tem múltiplos pontos (separadores de milhares), processar
    if (numericValue.includes('.') && numericValue.split('.').length > 2) {
        // Assumir que o último ponto são os centavos
        const parts = numericValue.split('.');
        const centavos = parts.pop().padEnd(2, '0').substring(0, 2);
        const reais = parts.join('');
        return `R$ ${reais},${centavos}`;
    }
    
    // Fallback: tentar interpretar como número decimal
    try {
        const parsed = parseFloat(numericValue.replace(',', '.'));
        if (!isNaN(parsed)) {
            return `R$ ${parsed.toFixed(2).replace('.', ',')}`;
        }
    } catch (e) {
        console.warn('Erro ao parsear valor:', numericValue);
    }
    
    // Se nada funcionou, retornar o valor original com prefixo R$
    return value.startsWith('R$') ? value : `R$ ${numericValue}`;
}

// Função para validar se o valor monetário está no formato correto
function isValidCurrency(value) {
    // Padrão: R$ seguido de números, vírgula e dois dígitos
    const pattern = /^R\$ \d+,\d{2}$/;
    return pattern.test(value);
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
    document.getElementById('valor').value = 'R$ 0,00';
    document.getElementById('dataVencimentoGroup').style.display = 'none';
    document.getElementById('dataVencimento').required = false;
}

export function handleFormSubmit(event) {
    event.preventDefault();

    try {
        // Coleta dados do formulário
        const rawDataVencimento = document.getElementById('dataVencimento').value;
        const motivo = document.getElementById('motivo').value;
        const rawValor = document.getElementById('valor').value;
        
        const formData = {
            codigo: document.getElementById('codigo').value.trim(),
            produto: document.getElementById('produto').value.trim(),
            quantidade: parseInt(document.getElementById('quantidade').value),
            motivo: motivo,
            dataVencimento: rawDataVencimento,
            valor: formatCurrency(rawValor),
            usuario: document.getElementById('usuario').value.trim()
        };

        // Validar dados
        const errors = validateForm(formData);
        if (errors.length > 0) {
            alert('Erro de validação:\n' + errors.join('\n'));
            return;
        }

        // Verificar se o valor está formatado corretamente
        if (!isValidCurrency(formData.valor)) {
            alert('Valor deve estar no formato correto (ex: R$ 10,50)');
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

// Configurar formatação automática do campo valor com lógica aprimorada
document.addEventListener('DOMContentLoaded', function() {
    const valorInput = document.getElementById('valor');
    
    if (valorInput) {
        // Inicializar com valor padrão
        valorInput.value = 'R$ 0,00';
        
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
            // Se o valor é padrão, selecionar tudo para facilitar edição
            if (e.target.value === 'R$ 0,00') {
                e.target.select();
            } else {
                // Posicionar cursor no final
                e.target.setSelectionRange(e.target.value.length, e.target.value.length);
            }
        });

        valorInput.addEventListener('blur', function(e) {
            // Formatar novamente ao perder o foco para garantir formato correto
            const formattedValue = formatCurrency(e.target.value);
            e.target.value = formattedValue;
        });

        // Interceptar colagem para formatar automaticamente
        valorInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const formattedValue = formatCurrency(pastedText);
            e.target.value = formattedValue;
        });

        // Interceptar teclas especiais para melhor UX
        valorInput.addEventListener('keydown', function(e) {
            // Permitir teclas de controle (backspace, delete, tab, escape, enter)
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true) ||
                // Permitir home, end, setas
                (e.keyCode >= 35 && e.keyCode <= 39)) {
                return;
            }
            
            // Permitir apenas números e vírgula
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && 
                (e.keyCode < 96 || e.keyCode > 105) && 
                e.keyCode !== 188) { // 188 é a vírgula
                e.preventDefault();
            }
        });
    }
});

// Exportar as funções de conversão de data para uso em outros módulos
export { formatDateToBrazilian, formatDateToISO };