const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const db = new sqlite3.Database('database.db');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            estoque_minimo INTEGER NOT NULL,
            valor_unitario REAL NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_produto TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            valor_total REAL NOT NULL,
            data_venda TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS transacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            valor REAL NOT NULL,
            descricao TEXT,
            data_transacao TEXT NOT NULL,
            data_abertura TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS fechamento_diario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_abertura TEXT NOT NULL,
            data_fechamento TEXT NOT NULL,
            valor_inicial REAL NOT NULL,
            valor_final REAL NOT NULL,
            total_vendas INTEGER NOT NULL,
            vendas TEXT NOT NULL
        )
    `);
});

let caixaInicial = 0;
let dataAbertura = null;
let caixaAberto = false;

app.post('/api/caixa-inicial', (req, res) => {
    caixaInicial = req.body.valor;
    dataAbertura = new Date().toISOString();
    caixaAberto = true;

    res.json({
        message: 'Valor inicial do caixa salvo com sucesso!',
        valor_inicial: caixaInicial,
        data_abertura: dataAbertura
    });
});

app.post('/api/resetar-transacoes', (req, res) => {
    db.run('DELETE FROM transacoes WHERE data_abertura = ?', [dataAbertura], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        res.json({ message: 'Transações resetadas com sucesso!' });
    });
});

app.get('/api/caixa-inicial', (req, res) => {
    res.json({
        valor_inicial: caixaInicial,
        data_abertura: dataAbertura,
        caixa_aberto: caixaAberto
    });
});

app.post('/api/fechamento-diario', (req, res) => {
    if (!caixaAberto) {
        res.status(400).json({ error: 'O caixa não está aberto' });
        return;
    }

    const { valor_final, total_vendas } = req.body;
    const dataFechamento = new Date().toISOString();

    db.all('SELECT * FROM vendas WHERE data_venda >= ?', [dataAbertura], (err, vendas) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const vendasString = JSON.stringify(vendas);

        db.run(
            'INSERT INTO fechamento_diario (data_abertura, data_fechamento, valor_inicial, valor_final, total_vendas, vendas) VALUES (?, ?, ?, ?, ?, ?)',
            [dataAbertura, dataFechamento, caixaInicial, valor_final, total_vendas, vendasString],
            function (err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                // Resetar o caixa ao fechar
                caixaInicial = 0;
                dataAbertura = null;
                caixaAberto = false;

                res.json({
                    message: 'Fechamento diário registrado com sucesso!',
                    caixa_fechado: true
                });
            }
        );
    });
});

app.get('/api/fechamentos-diarios', (req, res) => {
    db.all('SELECT * FROM fechamento_diario ORDER BY data_fechamento DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

app.get('/api/produtos', (req, res) => {
    db.all('SELECT * FROM produtos', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

app.get('/api/produtos/:codigo', (req, res) => {
    const { codigo } = req.params;
    db.get('SELECT * FROM produtos WHERE codigo = ?', [codigo], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: row });
    });
});

app.post('/api/produtos', (req, res) => {
    const { codigo, descricao, quantidade, estoque_minimo, valor_unitario } = req.body;
    db.run(
        'INSERT INTO produtos (codigo, descricao, quantidade, estoque_minimo, valor_unitario) VALUES (?, ?, ?, ?, ?)',
        [codigo, descricao, quantidade, estoque_minimo, valor_unitario],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/produtos/:id', (req, res) => {
    const { id } = req.params;
    const { codigo, descricao, quantidade, estoque_minimo, valor_unitario } = req.body;
    db.run(
        'UPDATE produtos SET codigo = ?, descricao = ?, quantidade = ?, estoque_minimo = ?, valor_unitario = ? WHERE id = ?',
        [codigo, descricao, quantidade, estoque_minimo, valor_unitario, id],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ changes: this.changes });
        }
    );
});

app.delete('/api/produtos/:id', (req, res) => {
    const { id } = req.params;
    db.run(
        'DELETE FROM produtos WHERE id = ?',
        id,
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ changes: this.changes });
        }
    );
});

app.post('/api/vendas', (req, res) => {
    if (!caixaAberto) {
        res.status(400).json({ error: 'O caixa não está aberto' });
        return;
    }

    const vendas = req.body;

    db.serialize(() => {
        const stmtUpdate = db.prepare('UPDATE produtos SET quantidade = quantidade - ? WHERE codigo = ?');
        const stmtInsert = db.prepare('INSERT INTO vendas (codigo_produto, quantidade, valor_total, data_venda) VALUES (?, ?, ?, ?)');
        const stmtTransacao = db.prepare('INSERT INTO transacoes (tipo, valor, descricao, data_transacao, data_abertura) VALUES (?, ?, ?, ?, ?)');

        vendas.forEach(venda => {
            stmtUpdate.run(venda.quantidade, venda.codigo);
            stmtInsert.run(venda.codigo, venda.quantidade, venda.valor_total, new Date().toISOString());
            stmtTransacao.run('venda', venda.valor_total, `Venda de ${venda.quantidade} unidades do produto ${venda.codigo}`, new Date().toISOString(), dataAbertura);
        });

        stmtUpdate.finalize();
        stmtInsert.finalize();
        stmtTransacao.finalize();

        res.json({ message: 'Venda realizada com sucesso!' });
    });
});

app.get('/api/estatisticas', (req, res) => {
    db.all('SELECT SUM(quantidade) as totalQuantidade, COUNT(*) as totalProdutos, SUM(quantidade * valor_unitario) as valorTotal FROM produtos', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows[0] });
    });
});

app.get('/api/alertas', (req, res) => {
    db.all('SELECT * FROM produtos WHERE quantidade <= estoque_minimo', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

app.get('/api/relatorios/estoque', (req, res) => {
    db.all('SELECT * FROM produtos WHERE quantidade < estoque_minimo', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

app.get('/api/relatorios/vendas', (req, res) => {
    db.all('SELECT * FROM vendas ORDER BY data_venda DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});