import { productCodes, productNames, userNames, setEditingRow, clearEditingState, formatDateToISO } from './form-handler.js';

let productCount = 0;

// Função para calcular dias até vencimento
function calcularDiasParaVencimento(dataVencimento) {
    if (!dataVencimento || dataVencimento.trim() === '') {
        return { status: 'sem-vencimento', texto: 'N/A', dias: null };
    }

    try {
        // Converter data brasileira DD/MM/YYYY para objeto Date
        const parts = dataVencimento.split('/');
        if (parts.length !== 3) {
            return { status: 'sem-vencimento', texto: 'N/A', dias: null };
        }

        const dia = parseInt(parts[0]);
        const mes = parseInt(parts[1]) - 1; // Mês no JavaScript é 0-indexado
        const ano = parseInt(parts[2]);

        // Validar se são números válidos
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
            return { status: 'sem-vencimento', texto: 'N/A', dias: null };
        }

        const dataVenc = new Date(ano, mes, dia);
        const hoje = new Date();
        
        // Zerar horas para comparar apenas a data
        hoje.setHours(0, 0, 0, 0);
        dataVenc.setHours(0, 0, 0, 0);

        // Calcular diferença em dias
        const diferenca = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

        if (diferenca < 0) {
            // Produto vencido
            const diasVencido = Math.abs(diferenca);
            return { 
                status: 'vencido', 
                texto: 'VENCIDO', 
                dias: diferenca,
                diasVencido: diasVencido
            };
        } else if (diferenca === 0) {
            // Vence hoje
            return { 
                status: 'vencido', 
                texto: 'HOJE', 
                dias: diferenca 
            };
        } else if (diferenca <= 7) {
            // Próximo do vencimento (1-7 dias)
            return { 
                status: 'proximo-vencimento', 
                texto: `${diferenca} dia${diferenca > 1 ? 's' : ''}`, 
                dias: diferenca 
            };
        } else {
            // Normal (8+ dias)
            return { 
                status: 'normal', 
                texto: `${diferenca} dias`, 
                dias: diferenca 
            };
        }

    } catch (error) {
        console.error('Erro ao calcular dias para vencimento:', error);
        return { status: 'sem-vencimento', texto: 'ERRO', dias: null };
    }
}

export function addProductToTable(produto) {
    productCount++;
    const tableBody = document.getElementById('productTable').querySelector('tbody');
    const row = document.createElement('tr');

    // Adicionar ID do produto como atributo data
    if (produto.id) {
        row.setAttribute('data-product-id', produto.id);
    }

    // Verificar se existe dataUltimaModificacao, senão usar a data de inserção
    const dataUltimaModificacao = produto.dataUltimaModificacao || produto.dataHoraInsercao;

    // Calcular status de vencimento
    const statusVencimento = produto.motivo === 'VENCIDO' 
        ? calcularDiasParaVencimento(produto.dataVencimento)
        : { status: 'sem-vencimento', texto: 'N/A', dias: null };

    row.innerHTML = `
        <td>${productCount}</td>
        <td>${escapeHtml(produto.codigo)}</td>
        <td>${escapeHtml(produto.valor)}</td>
        <td>${escapeHtml(produto.produto)}</td>
        <td>${produto.quantidade}</td>
        <td>${escapeHtml(produto.motivo)}</td>
        <td>${escapeHtml(produto.dataVencimento || '')}</td>
        <td class="${statusVencimento.status}" title="${getTooltipText(statusVencimento)}">${statusVencimento.texto}</td>
        <td>${escapeHtml(produto.usuario)}</td>
        <td>${escapeHtml(produto.dataHoraInsercao)}</td>
        <td>${escapeHtml(dataUltimaModificacao)}</td>
        <td>
            <button class="edit-button" onclick="editProduct(this)" title="Editar produto">
                ✏️ Editar
            </button>
            ${produto.id ? `<button class="delete-button" onclick="deleteProduct(this, ${produto.id})" title="Excluir produto" style="background-color: #dc3545; margin-left: 5px;">🗑️ Excluir</button>` : ''}
        </td>
    `;

    tableBody.appendChild(row);

    // Atualizar arrays de autocomplete
    updateAutocompleteArrays(produto);
}

// Função para gerar tooltip com informações detalhadas
function getTooltipText(statusVencimento) {
    switch (statusVencimento.status) {
        case 'vencido':
            if (statusVencimento.diasVencido) {
                return `Produto vencido há ${statusVencimento.diasVencido} dia${statusVencimento.diasVencido > 1 ? 's' : ''}`;
            }
            return statusVencimento.texto === 'HOJE' ? 'Produto vence hoje!' : 'Produto vencido';
        case 'proximo-vencimento':
            return `Atenção: vence em ${statusVencimento.dias} dia${statusVencimento.dias > 1 ? 's' : ''}`;
        case 'normal':
            return `Produto válido por mais ${statusVencimento.dias} dias`;
        case 'sem-vencimento':
            return 'Produto não possui data de vencimento';
        default:
            return '';
    }
}

export function editProduct(button) {
    try {
        const row = button.parentElement.parentElement;
        const productId = row.getAttribute('data-product-id');
        setEditingRow(row, productId);

        // Preencher formulário com dados da linha
        document.getElementById('codigo').value = getTextContent(row.children[1]);
        document.getElementById('valor').value = getTextContent(row.children[2]);
        document.getElementById('produto').value = getTextContent(row.children[3]);
        document.getElementById('quantidade').value = getTextContent(row.children[4]);
        
        const motivo = getTextContent(row.children[5]);
        document.getElementById('motivo').value = motivo;
        
        // CORREÇÃO: Processar data de vencimento corretamente
        const dataVencimento = getTextContent(row.children[6]);
        const dataVencimentoInput = document.getElementById('dataVencimento');
        const dataVencimentoGroup = document.getElementById('dataVencimentoGroup');
        
        if (motivo === 'VENCIDO') {
            dataVencimentoGroup.style.display = 'block';
            dataVencimentoInput.required = true;
            
            if (dataVencimento && dataVencimento.trim()) {
                // Converter data brasileira DD/MM/YYYY para formato ISO YYYY-MM-DD
                const isoDate = formatDateToISO(dataVencimento);
                dataVencimentoInput.value = isoDate;
                console.log('Data carregada para edição:', dataVencimento, '->', isoDate);
            } else {
                dataVencimentoInput.value = '';
            }
        } else {
            dataVencimentoGroup.style.display = 'none';
            dataVencimentoInput.required = false;
            dataVencimentoInput.value = '';
        }
        
        document.getElementById('usuario').value = getTextContent(row.children[8]); // Ajustado índice

        // Scroll para o formulário
        document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });
        
        // Focar no primeiro campo
        document.getElementById('codigo').focus();

    } catch (error) {
        console.error('Erro ao editar produto:', error);
        alert('Erro ao carregar dados do produto para edição');
    }
}

export function deleteProduct(button, productId) {
    if (!productId) {
        alert('ID do produto não encontrado');
        return;
    }

    if (!confirm('Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.')) {
        return;
    }

    fetch(`/deleteProduct/${productId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Remover linha da tabela
            const row = button.parentElement.parentElement;
            row.remove();
            
            // Atualizar numeração das linhas
            updateRowNumbers();
            
            alert('Produto excluído com sucesso!');
            
            // Limpar estado de edição se estava editando este produto
            clearEditingState();
            
        } else {
            alert('Erro ao excluir produto: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
        alert('Erro de conexão ao excluir produto');
    });
}

export function updateProductInTable(row, produto) {
    try {
        // Calcular novo status de vencimento
        const statusVencimento = produto.motivo === 'VENCIDO' 
            ? calcularDiasParaVencimento(produto.dataVencimento)
            : { status: 'sem-vencimento', texto: 'N/A', dias: null };

        row.children[1].textContent = produto.codigo;
        row.children[2].textContent = produto.valor;
        row.children[3].textContent = produto.produto;
        row.children[4].textContent = produto.quantidade;
        row.children[5].textContent = produto.motivo;
        row.children[6].textContent = produto.dataVencimento || '';
        
        // Atualizar coluna de status de vencimento
        const statusCell = row.children[7];
        statusCell.textContent = statusVencimento.texto;
        statusCell.className = statusVencimento.status;
        statusCell.title = getTooltipText(statusVencimento);
        
        row.children[8].textContent = produto.usuario;
        // Manter a data de criação original (children[9])
        row.children[10].textContent = produto.dataUltimaModificacao || getCurrentDateTime();

        // Atualizar arrays de autocomplete
        updateAutocompleteArrays(produto);

        // Destacar linha atualizada temporariamente
        row.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            row.style.backgroundColor = '';
        }, 2000);

    } catch (error) {
        console.error('Erro ao atualizar produto na tabela:', error);
        alert('Erro ao atualizar produto na tabela');
    }
}

// Função auxiliar para obter data/hora atual formatada
function getCurrentDateTime() {
    const now = new Date();
    return now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
}

// Função auxiliar para escapar HTML e prevenir XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Função auxiliar para obter conteúdo de texto de forma segura
function getTextContent(element) {
    return element ? element.textContent.trim() : '';
}

// Função para atualizar numeração das linhas após exclusão
function updateRowNumbers() {
    const tableBody = document.getElementById('productTable').querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');
    
    rows.forEach((row, index) => {
        row.children[0].textContent = index + 1;
    });
    
    productCount = rows.length;
}

// Função para atualizar arrays de autocomplete
function updateAutocompleteArrays(produto) {
    if (produto.codigo && !productCodes.includes(produto.codigo)) {
        productCodes.push(produto.codigo);
    }
    if (produto.produto && !productNames.includes(produto.produto)) {
        productNames.push(produto.produto);
    }
    if (produto.usuario && !userNames.includes(produto.usuario)) {
        userNames.push(produto.usuario);
    }
}

// Função para filtrar tabela (funcionalidade adicional)
export function filterTable(searchTerm) {
    const tableBody = document.getElementById('productTable').querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');
    
    if (!searchTerm) {
        rows.forEach(row => row.style.display = '');
        return;
    }
    
    searchTerm = searchTerm.toLowerCase();
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let found = false;
        
        // Buscar em todas as colunas exceto a de ações
        for (let i = 0; i < cells.length - 1; i++) {
            if (cells[i].textContent.toLowerCase().includes(searchTerm)) {
                found = true;
                break;
            }
        }
        
        row.style.display = found ? '' : 'none';
    });
}

// Função para atualizar automaticamente os status de vencimento
export function atualizarStatusVencimento() {
    const tableBody = document.getElementById('productTable').querySelector('tbody');
    const rows = tableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const motivo = getTextContent(row.children[5]);
        const dataVencimento = getTextContent(row.children[6]);
        
        if (motivo === 'VENCIDO' && dataVencimento) {
            const statusVencimento = calcularDiasParaVencimento(dataVencimento);
            const statusCell = row.children[7];
            
            // Atualizar apenas se mudou
            if (statusCell.textContent !== statusVencimento.texto) {
                statusCell.textContent = statusVencimento.texto;
                statusCell.className = statusVencimento.status;
                statusCell.title = getTooltipText(statusVencimento);
            }
        }
    });
}

// Atualizar status de vencimento a cada hora (3600000 ms)
setInterval(atualizarStatusVencimento, 3600000);

// Atualizar também quando a página ganha foco (usuário volta para a aba)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        atualizarStatusVencimento();
    }
});

// Tornar funções acessíveis globalmente
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;