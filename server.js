const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ExcelJS = require('exceljs');
const requestIp = require('request-ip');
const logger = require('./logger');

const app = express();
const port = process.env.PORT || 3500;

// Configuração de diretórios
const userDataDir = path.join(os.homedir(), 'EconomizeData');
if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
}

const productsFilePath = path.join(userDataDir, 'products.json');

// Inicialização dos produtos
let products = [];

function loadProducts() {
    try {
        if (fs.existsSync(productsFilePath)) {
            const productsData = fs.readFileSync(productsFilePath, 'utf8');
            products = JSON.parse(productsData);
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

// Middleware de validação para produtos
function validateProduct(req, res, next) {
    const { codigo, produto, quantidade, motivo, usuario, valor } = req.body;
    
    if (!codigo || !produto || !quantidade || !motivo || !usuario || !valor) {
        return res.status(400).json({ 
            success: false, 
            message: 'Todos os campos obrigatórios devem ser preenchidos' 
        });
    }
    
    if (isNaN(quantidade) || quantidade <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Quantidade deve ser um número maior que zero' 
        });
    }
    
    next();
}

// Carregar produtos na inicialização
loadProducts();

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/addProduct', validateProduct, (req, res) => {
    try {
        const product = {
            ...req.body,
            id: Date.now(), // Adicionar ID único
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        products.push(product);
        saveProductsToFile();
        
        res.json({ 
            success: true, 
            message: 'Produto adicionado com sucesso!',
            product: product
        });
        
        logger.log(`Produto adicionado: ${product.codigo} - ${product.produto}`);
    } catch (error) {
        logger.log(`Erro ao adicionar produto: ${error.message}`);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor' 
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

app.put('/updateProduct/:id', validateProduct, (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const productIndex = products.findIndex(p => p.id === productId);
        
        if (productIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Produto não encontrado' 
            });
        }
        
        products[productIndex] = {
            ...products[productIndex],
            ...req.body,
            updatedAt: new Date().toISOString()
        };
        
        saveProductsToFile();
        
        res.json({ 
            success: true, 
            message: 'Produto atualizado com sucesso!',
            product: products[productIndex]
        });
        
        logger.log(`Produto atualizado: ${products[productIndex].codigo}`);
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
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Produtos');

        // Definir colunas
        worksheet.columns = [
            { header: '#', key: 'id', width: 8 },
            { header: 'Código', key: 'codigo', width: 12 },
            { header: 'Produto', key: 'produto', width: 35 },
            { header: 'Valor', key: 'valor', width: 15 },
            { header: 'Quantidade', key: 'quantidade', width: 12 },
            { header: 'Motivo', key: 'motivo', width: 15 },
            { header: 'Data de Vencimento', key: 'dataVencimento', width: 20 },
            { header: 'Usuário', key: 'usuario', width: 15 },
            { header: 'Data e Hora de Inserção', key: 'dataHoraInsercao', width: 25 }
        ];

        // Adicionar dados
        products.forEach((product, index) => {
            worksheet.addRow({
                id: index + 1,
                codigo: product.codigo,
                produto: product.produto,
                valor: product.valor,
                quantidade: product.quantidade,
                motivo: product.motivo,
                dataVencimento: product.motivo === 'VENCIDO' ? product.dataVencimento : '',
                usuario: product.usuario,
                dataHoraInsercao: product.dataHoraInsercao
            });
        });

        // Estilizar planilha
        worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
            row.eachCell({ includeEmpty: false }, function (cell, colNumber) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                
                if (rowNumber === 1) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF9800' }
                    };
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                } else {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: rowNumber % 2 === 0 ? { argb: 'FFF6E7' } : { argb: 'FFFFFFFF' }
                    };
                }
            });
        });

        // Configurar resposta
        const filename = `produtos_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        await workbook.xlsx.write(res);
        res.end();

        logger.log(`Exportação Excel realizada: ${filename}`);
    } catch (error) {
        logger.log(`Erro na exportação Excel: ${error.message}`);
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

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`📊 Dashboard disponível em: http://localhost:${port}`);
    logger.log(`Servidor iniciado na porta ${port}`);
});