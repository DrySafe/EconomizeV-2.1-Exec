// Configura inicializações e carrega produtos no carregamento da página

import { addProductToTable } from './table-handler.js';
import { autocomplete } from './autocomplete.js';

const productCodes = [];
const productNames = [];
const userNames = [];

function showLoading(show = true) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background-color: #f8d7da;
        color: #721c24;
        padding: 10px;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        margin: 10px 0;
        text-align: center;
    `;
    errorDiv.textContent = message;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(errorDiv, container.firstChild);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Função para converter data brasileira (DD/MM/YYYY) para objeto Date
function parseDataBrasileira(dataBrasil) {
    if (!dataBrasil || !dataBrasil.includes('/')) return null;
    
    const parts = dataBrasil.split('/');
    if (parts.length !== 3) return null;
    
    const dia = parseInt(parts[0]);
    const mes = parseInt(parts[1]) - 1; // Mês no JavaScript é 0-indexado
    const ano = parseInt(parts[2]);
    
    // Validar se são números válidos
    if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
    if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || ano < 1900) return null;
    
    return new Date(ano, mes, dia);
}

// Função para verificar se um produto está realmente vencido
function isProdutoVencido(produto) {
    // Se o motivo não é VENCIDO, não está vencido
    if (produto.motivo !== 'VENCIDO') return false;
    
    // Se não tem data de vencimento, considerar como vencido (caso antigo)
    if (!produto.dataVencimento || produto.dataVencimento.trim() === '') return true;
    
    try {
        const dataVencimento = parseDataBrasileira(produto.dataVencimento);
        if (!dataVencimento) {
            console.warn('Data de vencimento inválida:', produto.dataVencimento);
            return true; // Se não conseguir parsear, considerar vencido por segurança
        }
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas a data
        dataVencimento.setHours(0, 0, 0, 0);
        
        // Produto está vencido se a data de vencimento for anterior a hoje
        const vencido = dataVencimento < hoje;
        
        // Log para debug
        console.log(`Produto ${produto.codigo}: Data vencimento ${produto.dataVencimento}, Hoje: ${hoje.toLocaleDateString('pt-BR')}, Vencido: ${vencido}`);
        
        return vencido;
    } catch (error) {
        console.error('Erro ao verificar vencimento do produto:', produto.codigo, error);
        return true; // Em caso de erro, considerar vencido por segurança
    }
}

function loadProducts() {
    showLoading(true);
    
    return fetch('/getProducts')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && Array.isArray(data.products)) {
                data.products.forEach(produto => {
                    addProductToTable(produto);
                    
                    // Adicionar aos arrays de autocomplete
                    if (produto.codigo && !productCodes.includes(produto.codigo)) {
                        productCodes.push(produto.codigo);
                    }
                    if (produto.produto && !productNames.includes(produto.produto)) {
                        productNames.push(produto.produto);
                    }
                    if (produto.usuario && !userNames.includes(produto.usuario)) {
                        userNames.push(produto.usuario);
                    }
                });
                
                console.log(`${data.products.length} produtos carregados com sucesso`);
                
                // Mostrar estatísticas na tela
                updateProductStats(data.products);
                
            } else if (data.products) {
                // Compatibilidade com formato antigo
                data.products.forEach(produto => addProductToTable(produto));
            } else {
                console.warn('Nenhum produto encontrado');
            }
        })
        .catch(error => {
            console.error('Erro ao carregar produtos:', error);
            showError('Erro ao carregar produtos. Verifique sua conexão e tente novamente.');
        })
        .finally(() => {
            showLoading(false);
        });
}

function updateProductStats(products) {
    const statsContainer = document.getElementById('product-stats');
    if (!statsContainer) return;
    
    const totalProducts = products.length;
    
    // CORREÇÃO: Contar apenas produtos realmente vencidos (data anterior a hoje)
    const vencidos = products.filter(produto => isProdutoVencido(produto)).length;
    
    // Contar produtos com motivo VENCIDO mas que ainda não venceram (para debug)
    const comMotivoVencido = products.filter(p => p.motivo === 'VENCIDO').length;
    const vencidosProximos = comMotivoVencido - vencidos; // Produtos próximos do vencimento
    
    const usoLoja = products.filter(p => p.motivo === 'USO LOJA').length;
    const avariados = products.filter(p => p.motivo === 'AVARIADO').length;
    const restaurante = products.filter(p => p.motivo === 'RESTAURANTE').length;
    
    // Log para debug
    console.log(`Estatísticas atualizadas:
        - Total: ${totalProducts}
        - Com motivo VENCIDO: ${comMotivoVencido}
        - Realmente vencidos: ${vencidos}
        - Próximos do vencimento: ${vencidosProximos}
        - Uso loja: ${usoLoja}
        - Avariados: ${avariados}
        - Restaurante: ${restaurante}`);
    
    statsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-number">${totalProducts}</span>
                <span class="stat-label">Total</span>
            </div>
            <div class="stat-item">
                <span class="stat-number" style="color: #e74c3c;">${vencidos}</span>
                <span class="stat-label">Vencidos</span>
            </div>
            ${vencidosProximos > 0 ? `
            <div class="stat-item">
                <span class="stat-number" style="color: #f39c12;">${vencidosProximos}</span>
                <span class="stat-label">Próximos Venc.</span>
            </div>
            ` : ''}
            <div class="stat-item">
                <span class="stat-number">${usoLoja}</span>
                <span class="stat-label">Uso Loja</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${avariados}</span>
                <span class="stat-label">Avariados</span>
            </div>
            ${restaurante > 0 ? `
            <div class="stat-item">
                <span class="stat-number">${restaurante}</span>
                <span class="stat-label">Restaurante</span>
            </div>
            ` : ''}
        </div>
    `;
}

function setupAutocomplete() {
    const codigoInput = document.getElementById('codigo');
    const produtoInput = document.getElementById('produto');
    const usuarioInput = document.getElementById('usuario');
    
    if (codigoInput && produtoInput && usuarioInput) {
        autocomplete(codigoInput, productCodes);
        autocomplete(produtoInput, productNames);
        autocomplete(usuarioInput, userNames);
        console.log('Autocomplete configurado');
    } else {
        console.warn('Alguns campos de input não foram encontrados para autocomplete');
    }
}

function setupSearchFunctionality() {
    // Adicionar campo de busca se não existir
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer && !document.getElementById('search-input')) {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.style.cssText = 'margin-bottom: 15px;';
        
        searchContainer.innerHTML = `
            <input type="text" 
                   id="search-input" 
                   placeholder="Buscar produtos..." 
                   style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
            />
        `;
        
        const h2 = tableContainer.querySelector('h2');
        if (h2) {
            h2.after(searchContainer);
        }
        
        // Configurar evento de busca
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                import('./table-handler.js').then(module => {
                    if (module.filterTable) {
                        module.filterTable(e.target.value);
                    }
                });
            });
        }
    }
}

function addStatsContainer() {
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer && !document.getElementById('product-stats')) {
        const statsContainer = document.createElement('div');
        statsContainer.id = 'product-stats';
        statsContainer.style.cssText = `
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        `;
        
        const h2 = tableContainer.querySelector('h2');
        if (h2) {
            h2.after(statsContainer);
        }
    }
}

function addLoadingIndicator() {
    if (!document.getElementById('loading')) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading';
        loadingDiv.style.cssText = `
            display: none;
            text-align: center;
            padding: 20px;
            font-size: 16px;
            color: #6c757d;
        `;
        loadingDiv.innerHTML = `
            <div style="display: inline-block; animation: spin 1s linear infinite; font-size: 20px;">⏳</div>
            <span style="margin-left: 10px;">Carregando produtos...</span>
        `;
        
        const container = document.querySelector('.container');
        if (container) {
            container.appendChild(loadingDiv);
        }
    }
}

function addCustomStyles() {
    if (!document.getElementById('custom-styles')) {
        const style = document.createElement('style');
        style.id = 'custom-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 15px;
                text-align: center;
            }
            
            .stat-item {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .stat-number {
                font-size: 24px;
                font-weight: bold;
                color: #ff9800;
            }
            
            .stat-label {
                font-size: 12px;
                color: #6c757d;
                margin-top: 5px;
            }
            
            .delete-button {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-left: 5px;
            }
            
            .delete-button:hover {
                background-color: #c82333;
            }
            
            .error-message {
                animation: slideIn 0.3s ease-out;
            }
            
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Função principal de inicialização
window.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando aplicação...');
    
    // Adicionar elementos necessários
    addLoadingIndicator();
    addStatsContainer();
    addCustomStyles();
    
    // Carregar produtos
    loadProducts()
        .then(() => {
            // Configurar funcionalidades após carregar produtos
            setupAutocomplete();
            setupSearchFunctionality();
            console.log('Aplicação inicializada com sucesso');
        })
        .catch(error => {
            console.error('Erro na inicialização:', error);
        });
});

// Exportar funções para uso em outros módulos
export { loadProducts, updateProductStats };