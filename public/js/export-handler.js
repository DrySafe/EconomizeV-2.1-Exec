//Implementa a funcionalidade de exportação para Excel com filtros.

// Função original mantida para compatibilidade
export function exportToExcel() {
    // Agora abre o modal de filtros ao invés de exportar diretamente
    showExportModal();
}

// Função para exportar com filtros (chamada pelo modal)
export function exportToExcelWithFilters(filters) {
    const url = new URL('/exportToExcel', window.location.origin);
    url.searchParams.append('filters', JSON.stringify(filters));

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro na exportação');
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(new Blob([blob]));
            const a = document.createElement('a');
            a.href = url;
            
            // Nome do arquivo baseado no filtro
            let filename = 'produtos';
            if (filters.type === 'motivo' && filters.motivos && filters.motivos.length === 1) {
                filename += `_${filters.motivos[0].toLowerCase().replace(/\s+/g, '_')}`;
            } else if (filters.type === 'status' && filters.status && filters.status.length === 1) {
                filename += `_${filters.status[0]}`;
            } else if (filters.type === 'usuario' && filters.usuarios && filters.usuarios.length === 1) {
                filename += `_${filters.usuarios[0].toLowerCase().replace(/\s+/g, '_')}`;
            } else if (filters.type !== 'all') {
                filename += `_filtrado`;
            }
            filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(err => {
            console.error('Erro ao exportar para Excel:', err);
            alert('Erro ao exportar planilha. Tente novamente.');
        });
}

// Função para mostrar o modal de filtros
function showExportModal() {
    // Verificar se o modal já existe
    let modal = document.getElementById('exportFilterModal');
    
    if (!modal) {
        // Criar o modal dinamicamente se não existir
        createExportModal();
        modal = document.getElementById('exportFilterModal');
    }
    
    modal.style.display = 'block';
    updateSelectionSummary();
}

// Função para criar o modal dinamicamente
function createExportModal() {
    const modalHTML = `
    <div id="exportFilterModal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);">
        <div class="modal-content" style="background-color: #fefefe; margin: 10% auto; padding: 20px; border: none; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); animation: modalSlideIn 0.3s ease-out;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0;">
                <h2 style="color: #333; margin: 0; font-size: 1.5em; background: linear-gradient(45deg, #ff9800, #f57c00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">📊 Opções de Exportação</h2>
                <span class="close" style="color: #aaa; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
            </div>
            <div class="filter-section" style="margin-bottom: 20px; background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0;">
                <h3 style="margin: 0 0 15px 0; color: #555; font-size: 1.1em;">🎯 Selecionar Dados</h3>
                <div class="filter-options" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <div class="filter-option selected" style="display: flex; align-items: center; padding: 8px; background: #fff3e0; border: 2px solid #ff9800; border-radius: 6px; cursor: pointer;">
                        <input type="radio" id="filter-all" name="filter-type" value="all" checked style="margin-right: 8px; accent-color: #ff9800;">
                        <label for="filter-all" style="cursor: pointer; font-weight: 500; color: #555; flex: 1;">📋 Todos os Produtos</label>
                    </div>
                    <div class="filter-option" style="display: flex; align-items: center; padding: 8px; background: white; border: 2px solid #e1e5e9; border-radius: 6px; cursor: pointer;">
                        <input type="radio" id="filter-motivo" name="filter-type" value="motivo" style="margin-right: 8px; accent-color: #ff9800;">
                        <label for="filter-motivo" style="cursor: pointer; font-weight: 500; color: #555; flex: 1;">🏷️ Por Motivo</label>
                    </div>
                </div>
            </div>
            <div id="motivo-options" class="filter-section" style="margin-bottom: 20px; background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; display: none;">
                <h3 style="margin: 0 0 15px 0; color: #555; font-size: 1.1em;">🏷️ Selecionar Motivos</h3>
                <div class="filter-options" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <div class="filter-option" style="display: flex; align-items: center; padding: 8px; background: white; border: 2px solid #e1e5e9; border-radius: 6px; cursor: pointer;">
                        <input type="checkbox" id="motivo-vencido" name="motivos" value="VENCIDO" style="margin-right: 8px; accent-color: #ff9800;">
                        <label for="motivo-vencido" style="cursor: pointer; font-weight: 500; color: #555; flex: 1;">⚠️ Vencidos</label>
                    </div>
                    <div class="filter-option" style="display: flex; align-items: center; padding: 8px; background: white; border: 2px solid #e1e5e9; border-radius: 6px; cursor: pointer;">
                        <input type="checkbox" id="motivo-uso-loja" name="motivos" value="USO LOJA" style="margin-right: 8px; accent-color: #ff9800;">
                        <label for="motivo-uso-loja" style="cursor: pointer; font-weight: 500; color: #555; flex: 1;">🏪 Uso Loja</label>
                    </div>
                    <div class="filter-option" style="display: flex; align-items: center; padding: 8px; background: white; border: 2px solid #e1e5e9; border-radius: 6px; cursor: pointer;">
                        <input type="checkbox" id="motivo-avariado" name="motivos" value="AVARIADO" style="margin-right: 8px; accent-color: #ff9800;">
                        <label for="motivo-avariado" style="cursor: pointer; font-weight: 500; color: #555; flex: 1;">📦 Avariados</label>
                    </div>
                    <div class="filter-option" style="display: flex; align-items: center; padding: 8px; background: white; border: 2px solid #e1e5e9; border-radius: 6px; cursor: pointer;">
                        <input type="checkbox" id="motivo-restaurante" name="motivos" value="RESTAURANTE" style="margin-right: 8px; accent-color: #ff9800;">
                        <label for="motivo-restaurante" style="cursor: pointer; font-weight: 500; color: #555; flex: 1;">🍽️ Restaurante</label>
                    </div>
                </div>
            </div>
            <div id="selection-summary" class="selection-summary" style="background: #e3f2fd; border: 1px solid #bbdefb; border-radius: 6px; padding: 10px; margin-top: 15px; font-size: 0.9em; color: #1976d2;">
                <strong>Seleção:</strong> Todos os produtos serão exportados
            </div>
            <div class="export-buttons" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                <button type="button" class="btn-export btn-secondary" id="cancelExport" style="padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; background: #6c757d; color: white;">
                    ❌ Cancelar
                </button>
                <button type="button" class="btn-export btn-primary" id="confirmExport" style="padding: 12px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; background: linear-gradient(45deg, #ff9800, #f57c00); color: white;">
                    📄 Exportar Excel
                </button>
            </div>
        </div>
    </div>
    <style>
        @keyframes modalSlideIn {
            from { opacity: 0; transform: translateY(-50px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .filter-option:hover { border-color: #ff9800 !important; background: #fff3e0 !important; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255, 152, 0, 0.3); }
        .btn-secondary:hover { background: #5a6268 !important; }
    </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupModalEventListeners();
}

// Configurar event listeners do modal
function setupModalEventListeners() {
    const modal = document.getElementById('exportFilterModal');
    const closeModal = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelExport');
    const confirmBtn = document.getElementById('confirmExport');
    const filterTypeInputs = document.querySelectorAll('input[name="filter-type"]');
    const motivoOptions = document.getElementById('motivo-options');

    // Fechar modal
    function closeExportModal() {
        modal.style.display = 'none';
    }

    closeModal.onclick = closeExportModal;
    cancelBtn.onclick = closeExportModal;

    // Fechar modal clicando fora dele
    window.onclick = function(event) {
        if (event.target === modal) {
            closeExportModal();
        }
    }

    // Mostrar/ocultar opções baseado no tipo de filtro selecionado
    filterTypeInputs.forEach(input => {
        input.addEventListener('change', function() {
            // Remover seleção visual anterior
            document.querySelectorAll('.filter-option').forEach(option => {
                option.classList.remove('selected');
                option.style.background = 'white';
                option.style.borderColor = '#e1e5e9';
            });

            // Marcar opção selecionada
            this.parentElement.classList.add('selected');
            this.parentElement.style.background = '#fff3e0';
            this.parentElement.style.borderColor = '#ff9800';

            // Ocultar todas as seções de opções
            motivoOptions.style.display = 'none';

            // Mostrar seção relevante
            if (this.value === 'motivo') {
                motivoOptions.style.display = 'block';
            }

            updateSelectionSummary();
        });
    });

    // Adicionar event listeners para checkboxes
    document.addEventListener('change', function(e) {
        if (e.target.name === 'motivos') {
            updateSelectionSummary();
        }
    });

    // Confirmar exportação
    confirmBtn.onclick = function() {
        const selectedType = document.querySelector('input[name="filter-type"]:checked').value;
        let filters = { type: selectedType };

        if (selectedType === 'motivo') {
            filters.motivos = Array.from(document.querySelectorAll('input[name="motivos"]:checked'))
                .map(input => input.value);
            if (filters.motivos.length === 0) {
                alert('Por favor, selecione pelo menos um motivo.');
                return;
            }
        }

        exportToExcelWithFilters(filters);
        closeExportModal();
    };
}

// Atualizar resumo da seleção
function updateSelectionSummary() {
    const selectionSummary = document.getElementById('selection-summary');
    if (!selectionSummary) return;

    const selectedType = document.querySelector('input[name="filter-type"]:checked').value;
    let summary = '';

    if (selectedType === 'all') {
        summary = 'Todos os produtos serão exportados';
    } else if (selectedType === 'motivo') {
        const selectedMotivos = Array.from(document.querySelectorAll('input[name="motivos"]:checked'))
            .map(input => input.nextElementSibling.textContent.trim());
        summary = selectedMotivos.length === 0
            ? 'Nenhum motivo selecionado'
            : `Motivos selecionados: ${selectedMotivos.join(', ')}`;
    }

    selectionSummary.innerHTML = `<strong>Seleção:</strong> ${summary}`;
}

// Carregar lista de usuários únicos
function loadUsuarios() {
    fetch('/getProducts')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.products) {
                const usuarios = [...new Set(data.products.map(p => p.usuario))].sort();
                const usuariosList = document.getElementById('usuarios-list');
                
                usuariosList.innerHTML = usuarios.map(usuario => `
                    <div class="filter-option" style="display: flex; align-items: center; padding: 8px; background: white; border: 2px solid #e1e5e9; border-radius: 6px; cursor: pointer;">
                        <input type="checkbox" id="usuario-${usuario.replace(/\s+/g, '_')}" name="usuarios" value="${usuario}" style="margin-right: 8px; accent-color: #ff9800;">
                        <label for="usuario-${usuario.replace(/\s+/g, '_')}" style="cursor: pointer; font-weight: 500; color: #555; flex: 1;">👤 ${usuario}</label>
                    </div>
                `).join('');

                // Adicionar event listeners para atualizar resumo
                document.querySelectorAll('input[name="usuarios"]').forEach(input => {
                    input.addEventListener('change', updateSelectionSummary);
                });
            }
        })
        .catch(error => {
            console.error('Erro ao carregar usuários:', error);
        });
}

// Tornar a função acessível globalmente para o botão de exportar
window.showExportModal = showExportModal;