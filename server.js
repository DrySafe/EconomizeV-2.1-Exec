const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ExcelJS = require('exceljs');
const requestIp = require('request-ip');
const logger = require('./logger');

const app = express();
const port = process.env.PORT || 3700;

// Configuração de diretórios
const userDataDir = path.join(os.homedir(), 'EconomizeData');
if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
}

const productsFilePath = path.join(userDataDir, 'products.json');

// Inicialização dos produtos
let products = [];

function getCurrentDateTime() {
    const now = new Date();
    return now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');
}

// Função para calcular dias até vencimento (mesma lógica do frontend)
function calcularDiasParaVencimento(dataVencimento) {
    if (!dataVencimento || dataVencimento.trim() === '') {
        return 'N/A';
    }

    try {
        // Converter data brasileira DD/MM/YYYY para objeto Date
        const parts = dataVencimento.split('/');
        if (parts.length !== 3) {
            return 'N/A';
        }

        const dia = parseInt(parts[0]);
        const mes = parseInt(parts[1]) - 1; // Mês no JavaScript é 0-indexado
        const ano = parseInt(parts[2]);

        // Validar se são números válidos
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
            return 'N/A';
        }

        const dataVenc = new Date(ano, mes, dia);
        const hoje = new Date();
        
        // Zerar horas para comparar apenas a data
        hoje.setHours(0, 0, 0, 0);
        dataVenc.setHours(0, 0, 0, 0);

        // Calcular diferença em dias
        const diferenca = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

        if (diferenca < 0) {
            return 'VENCIDO';
        } else if (diferenca === 0) {
            return 'HOJE';
        } else {
            return `${diferenca} dia${diferenca > 1 ? 's' : ''}`;
        }

    } catch (error) {
        console.error('Erro ao calcular dias para vencimento:', error);
        return 'ERRO';
    }
}

// Função para calcular desconto
function calcularValorIndicado(valorOriginal, dataVencimento) {
    if (!dataVencimento || !valorOriginal) return valorOriginal;
    // Extrai valor numérico do formato "R$ XX,XX"
    let valorNumerico = parseFloat(valorOriginal.replace(/[R$\s]/g, '').replace(',', '.'));
    if (isNaN(valorNumerico)) return valorOriginal;

    // Calcula dias para vencimento
    const parts = dataVencimento.split('/');
    if (parts.length !== 3) return valorOriginal;
    const dia = parseInt(parts[0]), mes = parseInt(parts[1]) - 1, ano = parseInt(parts[2]);
    const dataVenc = new Date(ano, mes, dia);
    const hoje = new Date();
    hoje.setHours(0,0,0,0); dataVenc.setHours(0,0,0,0);
    const dias = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

    let desconto = 0;
    if (dias <= 15) desconto = 45;
    else if (dias <= 30) desconto = 30;
    else if (dias <= 45) desconto = 15;

    if (desconto > 0) {
        const valorDescontado = valorNumerico * (1 - desconto / 100);
        return `R$ ${valorDescontado.toFixed(2).replace('.', ',')}`;
    }
    return valorOriginal;
}

function loadProducts() {
    try {
        if (fs.existsSync(productsFilePath)) {
            const productsData = fs.readFileSync(productsFilePath, 'utf8');
            products = JSON.parse(productsData);
            
            // Migrar produtos antigos para novo formato se necessário
            products = products.map(product => {
                if (!product.dataUltimaModificacao) {
                    return {
                        ...product,
                        dataUltimaModificacao: product.dataHoraInsercao || getCurrentDateTime()
                    };
                }
                return product;
            });
            
            logger.log(`Produtos carregados: ${products.length} itens`);
        }
    } catch (error) {
        logger.log(`Erro ao carregar produtos: ${error.message}`);
        products = [];
    }
}

function saveProductsToFile() {
    try {
        fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
        logger.log('Produtos salvos com sucesso');
    } catch (error) {
        logger.log(`Erro ao salvar produtos: ${error.message}`);
    }
}

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(requestIp.mw());

// Middleware de logging
app.use((req, res, next) => {
    const clientIp = req.clientIp;
    logger.log(`${req.method} ${req.url} - IP: ${clientIp}`);
    next();
});

// Carregar produtos na inicialização
loadProducts();

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/addProduct', (req, res) => {
    try {
        console.log('Dados recebidos:', req.body);
        
        const { codigo, produto, quantidade, motivo, usuario, valor } = req.body;
        
        // Validação básica
        if (!codigo || !produto || !quantidade || !motivo || !usuario || !valor) {
            const missingFields = [];
            if (!codigo) missingFields.push('codigo');
            if (!produto) missingFields.push('produto');
            if (!quantidade) missingFields.push('quantidade');
            if (!motivo) missingFields.push('motivo');
            if (!usuario) missingFields.push('usuario');
            if (!valor) missingFields.push('valor');
            
            console.log('Campos faltando:', missingFields);
            
            return res.status(400).json({ 
                success: false, 
                message: `Campos obrigatórios faltando: ${missingFields.join(', ')}` 
            });
        }
        
        if (isNaN(quantidade) || quantidade <= 0) {
            console.log('Quantidade inválida:', quantidade);
            return res.status(400).json({ 
                success: false, 
                message: 'Quantidade deve ser um número maior que zero' 
            });
        }

        const currentDateTime = getCurrentDateTime();
        
        // Log para debug da data de vencimento
        if (req.body.dataVencimento) {
            console.log('Data de vencimento recebida:', req.body.dataVencimento);
        }
        
        const product = {
            ...req.body,
            id: Date.now(),
            dataHoraInsercao: req.body.dataHoraInsercao || currentDateTime,
            dataUltimaModificacao: req.body.dataUltimaModificacao || currentDateTime,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        console.log('Produto a ser salvo:', product);
        
        products.push(product);
        saveProductsToFile();
        
        res.json({ 
            success: true, 
            message: 'Produto adicionado com sucesso!',
            product: product
        });
        
        logger.log(`Produto adicionado: ${product.codigo} - ${product.produto}`);
        console.log('Produto adicionado com sucesso');
        
    } catch (error) {
        logger.log(`Erro ao adicionar produto: ${error.message}`);
        console.error('Erro detalhado:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor: ' + error.message 
        });
    }
});

app.get('/getProducts', (req, res) => {
    try {
        res.json({
            success: true,
            products: products,
            total: products.length
        });
        logger.log(`Produtos consultados. Total: ${products.length}`);
    } catch (error) {
        logger.log(`Erro ao consultar produtos: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao consultar produtos' 
        });
    }
});

app.put('/updateProduct/:id', (req, res) => {
    try {
        console.log('Atualizando produto ID:', req.params.id);
        console.log('Dados para atualização:', req.body);
        
        const productId = parseInt(req.params.id);
        const productIndex = products.findIndex(p => p.id === productId);
        
        if (productIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produto não encontrado' 
            });
        }
        
        const originalProduct = products[productIndex];
        
        products[productIndex] = {
            ...originalProduct,
            ...req.body,
            dataHoraInsercao: originalProduct.dataHoraInsercao, // Manter data original
            dataUltimaModificacao: getCurrentDateTime(), // Atualizar data de modificação
            updatedAt: new Date().toISOString()
        };
        
        saveProductsToFile();
        
        res.json({ 
            success: true, 
            message: 'Produto atualizado com sucesso!',
            product: products[productIndex]
        });
        
        logger.log(`Produto atualizado: ${products[productIndex].codigo} - Modificado em: ${products[productIndex].dataUltimaModificacao}`);
    } catch (error) {
        logger.log(`Erro ao atualizar produto: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.delete('/deleteProduct/:id', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const productIndex = products.findIndex(p => p.id === productId);
        
        if (productIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produto não encontrado' 
            });
        }
        
        const deletedProduct = products.splice(productIndex, 1)[0];
        saveProductsToFile();
        
        res.json({ 
            success: true, 
            message: 'Produto removido com sucesso!' 
        });
        
        logger.log(`Produto removido: ${deletedProduct.codigo}`);
    } catch (error) {
        logger.log(`Erro ao remover produto: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.get('/exportToExcel', async (req, res) => {
    try {
        let productsToExport = [...products];
        let sheetName = 'Produtos';
        let filters = null;

        // Verificar se há filtros
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
                console.log('Filtros recebidos:', filters);

                // Aplicar filtro apenas por motivo
                if (filters.type === 'motivo' && filters.motivos && filters.motivos.length > 0) {
                    productsToExport = products.filter(p => filters.motivos.includes(p.motivo));
                    sheetName = filters.motivos.length === 1 ? 
                        `Produtos ${filters.motivos[0]}` : 
                        'Produtos Filtrados por Motivo';
                }
                // Se for 'all', exporta todos
            } catch (error) {
                console.error('Erro ao processar filtros:', error);
            }
        }

        console.log(`Exportando ${productsToExport.length} de ${products.length} produtos`);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        // Definir colunas
        worksheet.columns = [
            { header: '#', key: 'id', width: 8 },
            { header: 'Código', key: 'codigo', width: 12 },
            { header: 'Produto', key: 'produto', width: 35 },
            { header: 'Valor Original', key: 'valor', width: 15 },
            { header: 'Valor Indicado', key: 'valorIndicado', width: 15 }, // NOVA COLUNA
            { header: 'Quantidade', key: 'quantidade', width: 12 },
            { header: 'Motivo', key: 'motivo', width: 15 },
            { header: 'Data de Vencimento', key: 'dataVencimento', width: 20 },
            { header: 'Status Vencimento', key: 'statusVencimento', width: 18 },
            { header: 'Usuário', key: 'usuario', width: 15 },
            { header: 'Data de Criação', key: 'dataHoraInsercao', width: 20 },
            { header: 'Última Modificação', key: 'dataUltimaModificacao', width: 20 }
        ];

        // Adicionar informações do filtro como cabeçalho
        if (filters && filters.type !== 'all') {
            let filterInfo = '';
            switch(filters.type) {
                case 'motivo':
                    filterInfo = `Filtro aplicado: Motivos - ${filters.motivos.join(', ')}`;
                    break;
                case 'status':
                    const statusNames = {
                        'vencido': 'Vencidos',
                        'hoje': 'Vence Hoje',
                        'proximo': 'Próximo do Vencimento (1-7 dias)',
                        'normal': 'Normal (8+ dias)',
                        'sem': 'Sem Vencimento'
                    };
                    const statusTexts = filters.status.map(s => statusNames[s] || s);
                    filterInfo = `Filtro aplicado: Status - ${statusTexts.join(', ')}`;
                    break;
                case 'usuario':
                    filterInfo = `Filtro aplicado: Usuários - ${filters.usuarios.join(', ')}`;
                    break;
            }

            // Adicionar linha de informação do filtro
            worksheet.insertRow(1, [filterInfo]);
            worksheet.getCell('A1').font = { bold: true, color: { argb: 'FF0066CC' } };
            worksheet.mergeCells('A1:K1');
            worksheet.getCell('A1').alignment = { horizontal: 'center' };
            
            // Adicionar linha em branco
            worksheet.insertRow(2, []);
        }

        // Adicionar dados
        productsToExport.forEach((product, index) => {
            const statusVencimento = product.motivo === 'VENCIDO' 
                ? calcularDiasParaVencimento(product.dataVencimento)
                : 'N/A';
            const valorIndicado = calcularValorIndicado(product.valor, product.dataVencimento);

            worksheet.addRow({
                id: index + 1,
                codigo: product.codigo,
                produto: product.produto,
                valor: product.valor,
                valorIndicado: valorIndicado, // NOVO VALOR CALCULADO
                quantidade: product.quantidade,
                motivo: product.motivo,
                dataVencimento: product.motivo === 'VENCIDO' ? product.dataVencimento : '',
                statusVencimento: statusVencimento,
                usuario: product.usuario,
                dataHoraInsercao: product.dataHoraInsercao,
                dataUltimaModificacao: product.dataUltimaModificacao || product.dataHoraInsercao
            });
        });

        // Estilizar planilha
        const headerRow = filters && filters.type !== 'all' ? 3 : 1; // Calcule a linha do cabeçalho corretamente
        
        worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
            if (rowNumber < headerRow) return; // Pular linhas de filtro/informação

            row.eachCell({ includeEmpty: false }, function (cell, colNumber) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                
                if (rowNumber === headerRow) {
                    // Cabeçalho
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF9800' }
                    };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                } else {
                    // Dados - colorir coluna de status de vencimento
                    if (colNumber === 8) { // Coluna Status Vencimento
                        const statusText = cell.value;
                        if (statusText === 'VENCIDO' || statusText === 'HOJE') {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFEBEE' }
                            };
                            cell.font = { color: { argb: 'FFC62828' }, bold: true };
                        } else if (statusText && statusText.includes('dia') && !statusText.includes('dias')) {
                            // 1 dia - próximo do vencimento
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFF3E0' }
                            };
                            cell.font = { color: { argb: 'FFEF6C00' }, bold: true };
                        } else if (statusText && statusText.match(/^[1-7] dias$/)) {
                            // 2-7 dias - próximo do vencimento
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFF3E0' }
                            };
                            cell.font = { color: { argb: 'FFEF6C00' }, bold: true };
                        } else if (statusText && statusText.includes('dias') && statusText !== 'N/A') {
                            // 8+ dias - normal
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFE8F5E8' }
                            };
                            cell.font = { color: { argb: 'FF2E7D32' }, bold: true };
                        }
                    } else {
                        // Outras colunas - alternação de cores normal
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: rowNumber % 2 === 0 ? { argb: 'FFF6E7' } : { argb: 'FFFFFFFF' }
                        };
                    }
                }
            });
        });

        // Nome do arquivo baseado no filtro
        let filename = 'produtos';
        if (filters) {
            switch(filters.type) {
                case 'motivo':
                    if (filters.motivos && filters.motivos.length === 1) {
                        filename += `_${filters.motivos[0].toLowerCase().replace(/\s+/g, '_')}`;
                    } else if (filters.motivos && filters.motivos.length > 1) {
                        filename += '_por_motivo';
                    }
                    break;
                case 'status':
                    filename += '_por_status';
                    break;
                case 'usuario':
                    if (filters.usuarios && filters.usuarios.length === 1) {
                        filename += `_${filters.usuarios[0].toLowerCase().replace(/\s+/g, '_')}`;
                    } else if (filters.usuarios && filters.usuarios.length > 1) {
                        filename += '_por_usuario';
                    }
                    break;
            }
        }
        filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Configurar resposta
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        await workbook.xlsx.write(res);
        res.end();

        logger.log(`Exportação Excel realizada: ${filename} - ${productsToExport.length} produtos`);
    } catch (error) {
        logger.log(`Erro na exportação Excel: ${error.message}`);
        console.error('Erro detalhado na exportação:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao exportar para Excel' 
        });
    }
});

app.post('/resetProducts', (req, res) => {
    try {
        const { password } = req.body;

        if (password !== '1234') {
            return res.status(401).json({ 
                success: false, 
                message: 'Senha incorreta' 
            });
        }

        // Criar backup antes de resetar
        if (products.length > 0) {
            const backupFilePath = path.join(userDataDir, `products_backup_${Date.now()}.json`);
            fs.copyFileSync(productsFilePath, backupFilePath);
            logger.log(`Backup criado em: ${backupFilePath}`);
        }

        products = [];
        saveProductsToFile();

        res.json({ 
            success: true, 
            message: 'Lista de produtos resetada com sucesso' 
        });
        
        logger.log('Lista de produtos resetada');
    } catch (error) {
        logger.log(`Erro ao resetar produtos: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
        });
    }
});

app.post('/logEdit', (req, res) => {
    try {
        const { action, product } = req.body;
        logger.log(`Ação: ${action} - Produto: ${JSON.stringify(product)}`);
        res.json({ success: true });
    } catch (error) {
        logger.log(`Erro no log de edição: ${error.message}`);
        res.status(500).json({ success: false });
    }
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    logger.log(`Erro não tratado: ${err.message}`);
    res.status(500).json({ 
        success: false, 
        message: 'Erro interno do servidor' 
    });
});

// Rota 404
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Rota não encontrada' 
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.log('Servidor sendo finalizado...');
    saveProductsToFile();
    process.exit(0);
});

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Função auxiliar para calcular status de vencimento para filtros
function calcularStatusVencimento(dataVencimento) {
    if (!dataVencimento || dataVencimento.trim() === '') {
        return 'sem';
    }

    try {
        const parts = dataVencimento.split('/');
        if (parts.length !== 3) {
            return 'sem';
        }

        const dia = parseInt(parts[0]);
        const mes = parseInt(parts[1]) - 1;
        const ano = parseInt(parts[2]);

        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) {
            return 'sem';
        }

        const dataVenc = new Date(ano, mes, dia);
        const hoje = new Date();
        
        hoje.setHours(0, 0, 0, 0);
        dataVenc.setHours(0, 0, 0, 0);

        const diferenca = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));

        if (diferenca < 0) {
            return 'vencido';
        } else if (diferenca === 0) {
            return 'hoje';
        } else if (diferenca <= 7) {
            return 'proximo';
        } else {
            return 'normal';
        }

    } catch (error) {
        console.error('Erro ao calcular status de vencimento:', error);
        return 'sem';
    }
}

// ROTA ATUALIZADA PARA EXPORTAÇÃO COM FILTROS
app.get('/exportToExcel', async (req, res) => {
    try {
        let productsToExport = [...products]; // Cópia dos produtos
        let sheetName = 'Produtos';
        let filters = null;

        // Verificar se há filtros
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
                console.log('Filtros recebidos:', filters);

                // Aplicar filtro apenas por motivo
                if (filters.type === 'motivo' && filters.motivos && filters.motivos.length > 0) {
                    productsToExport = products.filter(p => filters.motivos.includes(p.motivo));
                    sheetName = filters.motivos.length === 1 ? 
                        `Produtos ${filters.motivos[0]}` : 
                        'Produtos Filtrados por Motivo';
                }
                // Se for 'all', exporta todos
            } catch (error) {
                console.error('Erro ao processar filtros:', error);
                // Continuar com todos os produtos se houver erro nos filtros
            }
        }

        console.log(`Exportando ${productsToExport.length} de ${products.length} produtos`);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        // Definir colunas
        worksheet.columns = [
            { header: '#', key: 'id', width: 8 },
            { header: 'Código', key: 'codigo', width: 12 },
            { header: 'Produto', key: 'produto', width: 35 },
            { header: 'Valor Original', key: 'valor', width: 15 },
            { header: 'Valor Indicado', key: 'valorIndicado', width: 15 }, // NOVA COLUNA
            { header: 'Quantidade', key: 'quantidade', width: 12 },
            { header: 'Motivo', key: 'motivo', width: 15 },
            { header: 'Data de Vencimento', key: 'dataVencimento', width: 20 },
            { header: 'Status Vencimento', key: 'statusVencimento', width: 18 },
            { header: 'Usuário', key: 'usuario', width: 15 },
            { header: 'Data de Criação', key: 'dataHoraInsercao', width: 20 },
            { header: 'Última Modificação', key: 'dataUltimaModificacao', width: 20 }
        ];

        // Adicionar informações do filtro como cabeçalho
        if (filters && filters.type !== 'all') {
            let filterInfo = '';
            switch(filters.type) {
                case 'motivo':
                    filterInfo = `Filtro aplicado: Motivos - ${filters.motivos.join(', ')}`;
                    break;
                case 'status':
                    const statusNames = {
                        'vencido': 'Vencidos',
                        'hoje': 'Vence Hoje',
                        'proximo': 'Próximo do Vencimento (1-7 dias)',
                        'normal': 'Normal (8+ dias)',
                        'sem': 'Sem Vencimento'
                    };
                    const statusTexts = filters.status.map(s => statusNames[s] || s);
                    filterInfo = `Filtro aplicado: Status - ${statusTexts.join(', ')}`;
                    break;
                case 'usuario':
                    filterInfo = `Filtro aplicado: Usuários - ${filters.usuarios.join(', ')}`;
                    break;
            }

            // Adicionar linha de informação do filtro
            worksheet.insertRow(1, [filterInfo]);
            worksheet.getCell('A1').font = { bold: true, color: { argb: 'FF0066CC' } };
            worksheet.mergeCells('A1:K1');
            worksheet.getCell('A1').alignment = { horizontal: 'center' };
            
            // Adicionar linha em branco
            worksheet.insertRow(2, []);
        }

        // Adicionar dados
        productsToExport.forEach((product, index) => {
            const statusVencimento = product.motivo === 'VENCIDO' 
                ? calcularDiasParaVencimento(product.dataVencimento)
                : 'N/A';
            const valorIndicado = calcularValorIndicado(product.valor, product.dataVencimento);

            worksheet.addRow({
                id: index + 1,
                codigo: product.codigo,
                produto: product.produto,
                valor: product.valor,
                valorIndicado: valorIndicado, // NOVO VALOR CALCULADO
                quantidade: product.quantidade,
                motivo: product.motivo,
                dataVencimento: product.motivo === 'VENCIDO' ? product.dataVencimento : '',
                statusVencimento: statusVencimento,
                usuario: product.usuario,
                dataHoraInsercao: product.dataHoraInsercao,
                dataUltimaModificacao: product.dataUltimaModificacao || product.dataHoraInsercao
            });
        });

        // Estilizar planilha
        const headerRow = filters && filters.type !== 'all' ? 3 : 1; // Calcule a linha do cabeçalho corretamente
        
        worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
            if (rowNumber < headerRow) return; // Pular linhas de filtro/informação

            row.eachCell({ includeEmpty: false }, function (cell, colNumber) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                
                if (rowNumber === headerRow) {
                    // Cabeçalho
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF9800' }
                    };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                } else {
                    // Dados - colorir coluna de status de vencimento
                    if (colNumber === 8) { // Coluna Status Vencimento
                        const statusText = cell.value;
                        if (statusText === 'VENCIDO' || statusText === 'HOJE') {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFEBEE' }
                            };
                            cell.font = { color: { argb: 'FFC62828' }, bold: true };
                        } else if (statusText && statusText.includes('dia') && !statusText.includes('dias')) {
                            // 1 dia - próximo do vencimento
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFF3E0' }
                            };
                            cell.font = { color: { argb: 'FFEF6C00' }, bold: true };
                        } else if (statusText && statusText.match(/^[1-7] dias$/)) {
                            // 2-7 dias - próximo do vencimento
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFF3E0' }
                            };
                            cell.font = { color: { argb: 'FFEF6C00' }, bold: true };
                        } else if (statusText && statusText.includes('dias') && statusText !== 'N/A') {
                            // 8+ dias - normal
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFE8F5E8' }
                            };
                            cell.font = { color: { argb: 'FF2E7D32' }, bold: true };
                        }
                    } else {
                        // Outras colunas - alternação de cores normal
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: rowNumber % 2 === 0 ? { argb: 'FFF6E7' } : { argb: 'FFFFFFFF' }
                        };
                    }
                }
            });
        });

        // Nome do arquivo baseado no filtro
        let filename = 'produtos';
        if (filters) {
            switch(filters.type) {
                case 'motivo':
                    if (filters.motivos && filters.motivos.length === 1) {
                        filename += `_${filters.motivos[0].toLowerCase().replace(/\s+/g, '_')}`;
                    } else if (filters.motivos && filters.motivos.length > 1) {
                        filename += '_por_motivo';
                    }
                    break;
                case 'status':
                    filename += '_por_status';
                    break;
                case 'usuario':
                    if (filters.usuarios && filters.usuarios.length === 1) {
                        filename += `_${filters.usuarios[0].toLowerCase().replace(/\s+/g, '_')}`;
                    } else if (filters.usuarios && filters.usuarios.length > 1) {
                        filename += '_por_usuario';
                    }
                    break;
            }
        }
        filename += `_${new Date().toISOString().split('T')[0]}.xlsx`;

        // Configurar resposta
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        await workbook.xlsx.write(res);
        res.end();

        logger.log(`Exportação Excel realizada: ${filename} - ${productsToExport.length} produtos`);
    } catch (error) {
        logger.log(`Erro na exportação Excel: ${error.message}`);
        console.error('Erro detalhado na exportação:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao exportar para Excel' 
        });
    }
});

app.listen(port, '0.0.0.0', () => {
    const localIp = getLocalIp();
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`📊 Dashboard disponível em:`);
    console.log(`   → http://localhost:${port}`);
    console.log(`   → http://${localIp}:${port}`);
    logger.log(`Servidor iniciado em http://${localIp}:${port}`);
});